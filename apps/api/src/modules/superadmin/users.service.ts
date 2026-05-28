import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, eq, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as bcrypt from "bcrypt";
import { hcenters, hcenterusers } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CreateUserInClinicDto,
  CrossClinicUser,
  CrossClinicUserListResponse,
  ListUsersQueryDto,
} from "./dto/superadmin.dto";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class SuperadminUsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  // ── Cross-clinic users list ───────────────────────────────────────────────

  async list(query: ListUsersQueryDto): Promise<CrossClinicUserListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const filters = [];
    if (query.q) {
      const pat = `%${query.q.trim()}%`;
      filters.push(
        or(
          like(hcenterusers.userName, pat),
          like(hcenterusers.firstName, pat),
          like(hcenterusers.lastName, pat),
        ),
      );
    }
    if (query.clinicId) filters.push(eq(hcenterusers.hcenterId, query.clinicId));
    if (query.active === "true") filters.push(eq(hcenterusers.isActive, 1));
    else if (query.active === "false") filters.push(eq(hcenterusers.isActive, 0));

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [countRow]] = await Promise.all([
      this.db
        .select({
          userId: hcenterusers.userId,
          userName: hcenterusers.userName,
          firstName: hcenterusers.firstName,
          secondName: hcenterusers.secondName,
          thirdName: hcenterusers.thirdName,
          lastName: hcenterusers.lastName,
          userType: hcenterusers.userType,
          isAdmin: hcenterusers.isAdmin,
          isSuperAdmin: hcenterusers.isSuperAdmin,
          isActive: hcenterusers.isActive,
          hcenterId: hcenterusers.hcenterId,
          clinicName: hcenters.hcenterName,
        })
        .from(hcenterusers)
        .innerJoin(hcenters, eq(hcenters.hcenterId, hcenterusers.hcenterId))
        .where(where)
        .orderBy(asc(hcenters.hcenterName), asc(hcenterusers.firstName))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ n: count() }).from(hcenterusers).where(where),
    ]);

    const data: CrossClinicUser[] = rows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? "",
      fullName: [r.firstName, r.secondName, r.thirdName, r.lastName]
        .filter((x): x is string => !!x && x.trim().length > 0).join(" ") || (r.userName ?? "—"),
      userType: r.userType,
      isAdmin: r.isAdmin === 1,
      isSuperAdmin: r.isSuperAdmin === 1,
      isActive: r.isActive === 1,
      hcenterId: r.hcenterId,
      clinicName: r.clinicName,
    }));

    return { data, total: countRow?.n ?? 0, page, pageSize };
  }

  // ── Create user in a specific clinic ──────────────────────────────────────

  async createInClinic(clinicId: string, dto: CreateUserInClinicDto): Promise<{ userId: string }> {
    // Verify clinic
    const [clinic] = await this.db.select({ id: hcenters.hcenterId }).from(hcenters)
      .where(eq(hcenters.hcenterId, clinicId)).limit(1);
    if (!clinic) throw new NotFoundException(`Clinic ${clinicId} not found`);

    // Unique username within clinic
    const [existing] = await this.db.select({ id: hcenterusers.userId }).from(hcenterusers)
      .where(and(eq(hcenterusers.userName, dto.userName), eq(hcenterusers.hcenterId, clinicId)))
      .limit(1);
    if (existing) throw new ConflictException(`Username "${dto.userName}" already taken in this clinic`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const id = randomUUID();
    const now = fmtDate(new Date());

    // Same insert quirk as admin-users.service.ts: cast through `any` so
    // Drizzle's `userId`-not-in-insert-type and required createdAt/updatedAt
    // pass through to the DB.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.db.insert(hcenterusers).values({
      ...(({ userId: id }) as any),
      hcenterId: clinicId,
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
      isSuperAdmin: dto.isSuperAdmin ? 1 : 0,
      isActive: 1,
      isPublic: 0,
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
      newValues: { userName: dto.userName, clinicId, isSuperAdmin: !!dto.isSuperAdmin },
    });

    return { userId: id };
  }
}

function fmtDate(v: Date): string {
  const y = v.getUTCFullYear();
  const mo = String(v.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(v.getUTCDate()).padStart(2, "0");
  const h  = String(v.getUTCHours()).padStart(2, "0");
  const mi = String(v.getUTCMinutes()).padStart(2, "0");
  const s  = String(v.getUTCSeconds()).padStart(2, "0");
  const ms = String(v.getUTCMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
