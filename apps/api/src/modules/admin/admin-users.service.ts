import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as bcrypt from "bcrypt";
import {
  hcenterspecialities,
  hcenterusers,
  hcuserspermissions,
  permissions,
  specialities,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type {
  AdminUserItem,
  CreateUserDto,
  PermissionItem,
  SetPermissionsDto,
  UpdateUserDto,
} from "./dto/admin.dto";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(): Promise<AdminUserItem[]> {
    const rows = await this.tdb.db
      .select({
        userId: hcenterusers.userId,
        userName: hcenterusers.userName,
        firstName: hcenterusers.firstName,
        secondName: hcenterusers.secondName,
        thirdName: hcenterusers.thirdName,
        lastName: hcenterusers.lastName,
        userType: hcenterusers.userType,
        position: hcenterusers.position,
        isAdmin: hcenterusers.isAdmin,
        isFinancialAdmin: hcenterusers.isFinancialAdmin,
        isActive: hcenterusers.isActive,
        specialityName: specialities.specialityName,
      })
      .from(hcenterusers)
      .leftJoin(hcenterspecialities, eq(hcenterspecialities.hcenterSpecialityId, hcenterusers.hcenterSpecialityId))
      .leftJoin(specialities, eq(specialities.specialityId, hcenterspecialities.specialityId))
      .where(eq(hcenterusers.hcenterId, this.tdb.tenantId))
      .orderBy(asc(hcenterusers.firstName));

    return rows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? "",
      fullName: composeName([r.firstName, r.secondName, r.thirdName, r.lastName]),
      userType: r.userType,
      position: r.position ?? null,
      isAdmin: r.isAdmin === 1,
      isFinancialAdmin: r.isFinancialAdmin === 1,
      isActive: r.isActive === 1,
      specialityName: r.specialityName ?? null,
    }));
  }

  async createUser(dto: CreateUserDto): Promise<{ userId: string }> {
    // Unique userName check within tenant
    const [existing] = await this.tdb.db
      .select({ id: hcenterusers.userId })
      .from(hcenterusers)
      .where(
        and(
          eq(hcenterusers.userName, dto.userName),
          eq(hcenterusers.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (existing) throw new ConflictException(`Username "${dto.userName}" is already taken`);

    if (dto.hcenterSpecialityId) {
      await this.assertSpecialityInTenant(dto.hcenterSpecialityId);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const id = randomUUID();
    const now = fmtDate(new Date());

    // Drizzle's $inferInsert for hcenterusers excludes `userId` from the type
    // (introspection quirk — the column has no $defaultFn but Drizzle omits it).
    // We pass it via a type-cast spread so the DB receives the correct UUID.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.tdb.db.insert(hcenterusers).values({
      ...(({ userId: id }) as any),
      hcenterId: this.tdb.tenantId,
      userName: dto.userName,
      passwordHash,
      firstName: dto.firstName,
      secondName: dto.secondName?.trim() || null,
      thirdName: null,
      lastName: dto.lastName,
      userType: dto.userType,
      position: dto.position?.trim() || null,
      isAdmin: dto.isAdmin ? 1 : 0,
      isFinancialAdmin: dto.isFinancialAdmin ? 1 : 0,
      isActive: 1,
      isPublic: 0,
      hcenterSpecialityId: dto.hcenterSpecialityId ?? null,
      isOptometrist: 0,
      isOperationsRoomAppointmentsManager: 0,
      createdAt: now,
      updatedAt: now,
    } as any);

    await this.audit.record({
      action: "Create",
      entityType: "HCenterUser",
      entityId: id,
      patientContext: null,
      newValues: { userName: dto.userName, userType: dto.userType, isAdmin: !!dto.isAdmin },
    });

    return { userId: id };
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<void> {
    const [current] = await this.tdb.db
      .select()
      .from(hcenterusers)
      .where(
        and(
          eq(hcenterusers.userId, userId),
          eq(hcenterusers.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`User ${userId} not found`);

    if (dto.hcenterSpecialityId) {
      await this.assertSpecialityInTenant(dto.hcenterSpecialityId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.firstName !== undefined) setFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) setFields.lastName = dto.lastName;
    if (dto.secondName !== undefined) setFields.secondName = dto.secondName?.trim() || null;
    if (dto.userType !== undefined) setFields.userType = dto.userType;
    if (dto.position !== undefined) setFields.position = dto.position?.trim() || null;
    if (dto.isAdmin !== undefined) setFields.isAdmin = dto.isAdmin ? 1 : 0;
    if (dto.isFinancialAdmin !== undefined) setFields.isFinancialAdmin = dto.isFinancialAdmin ? 1 : 0;
    if (dto.isActive !== undefined) setFields.isActive = dto.isActive ? 1 : 0;
    if (dto.hcenterSpecialityId !== undefined) setFields.hcenterSpecialityId = dto.hcenterSpecialityId || null;
    if (dto.password) {
      setFields.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    if (Object.keys(setFields).length === 0) return;

    await this.tdb.db
      .update(hcenterusers)
      .set(setFields)
      .where(eq(hcenterusers.userId, userId));

    const logFields = { ...setFields };
    delete logFields.passwordHash; // never log password hashes
    if (dto.password) logFields.passwordChanged = true;

    await this.audit.record({
      action: "Update",
      entityType: "HCenterUser",
      entityId: userId,
      patientContext: null,
      newValues: logFields,
    });
  }

  async listPermissions(): Promise<PermissionItem[]> {
    const rows = await this.tdb.db
      .select()
      .from(permissions)
      .orderBy(permissions.permissionType, permissions.permissionName);

    return rows.map((r) => ({
      permissionId: r.permissionId,
      permissionName: r.permissionName,
      permissionType: r.permissionType,
    }));
  }

  async getUserPermissions(userId: string): Promise<number[]> {
    await this.assertUserInTenant(userId);

    const rows = await this.tdb.db
      .select({ permissionId: hcuserspermissions.permissionId })
      .from(hcuserspermissions)
      .where(eq(hcuserspermissions.userId, userId));

    return rows.map((r) => r.permissionId);
  }

  async setUserPermissions(userId: string, dto: SetPermissionsDto): Promise<void> {
    await this.assertUserInTenant(userId);

    // Delete existing then insert new — simple bulk replace
    await this.tdb.db
      .delete(hcuserspermissions)
      .where(eq(hcuserspermissions.userId, userId));

    if (dto.permissionIds.length > 0) {
      await this.tdb.db.insert(hcuserspermissions).values(
        dto.permissionIds.map((pid) => ({ userId, permissionId: pid })),
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "UserPermissions",
      entityId: userId,
      patientContext: null,
      newValues: { permissionIds: dto.permissionIds },
    });
  }

  private async assertUserInTenant(userId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: hcenterusers.userId })
      .from(hcenterusers)
      .where(
        and(
          eq(hcenterusers.userId, userId),
          eq(hcenterusers.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`User ${userId} not found`);
  }

  private async assertSpecialityInTenant(specialityId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: hcenterspecialities.hcenterSpecialityId })
      .from(hcenterspecialities)
      .where(
        and(
          eq(hcenterspecialities.hcenterSpecialityId, specialityId),
          eq(hcenterspecialities.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new BadRequestException(`Speciality ${specialityId} not in this HCenter`);
  }
}

function composeName(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(" ").trim();
}

function fmtDate(v: Date): string {
  const y=v.getUTCFullYear(),mo=String(v.getUTCMonth()+1).padStart(2,"0"),d=String(v.getUTCDate()).padStart(2,"0");
  const h=String(v.getUTCHours()).padStart(2,"0"),mi=String(v.getUTCMinutes()).padStart(2,"0"),s=String(v.getUTCSeconds()).padStart(2,"0"),ms=String(v.getUTCMilliseconds()).padStart(3,"0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
