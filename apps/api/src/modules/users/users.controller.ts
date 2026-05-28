import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { and, asc, eq } from "drizzle-orm";
import { hcenterusers } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";

export interface UserListItem {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  isAdmin: boolean;
  isActive: boolean;
}

/**
 * Minimal users-in-tenant listing. Used right now by the scheduling doctor
 * picker. Will grow into a full admin/users module later.
 */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly tdb: TenantDbService) {}

  @Get()
  @ApiQuery({ name: "activeOnly", required: false, type: Boolean })
  async list(@Query("activeOnly") activeOnly?: string): Promise<UserListItem[]> {
    const onlyActive = activeOnly !== "false";
    const filters = [eq(hcenterusers.hcenterId, this.tdb.tenantId)];
    if (onlyActive) filters.push(eq(hcenterusers.isActive, 1));

    const rows = await this.tdb.db
      .select({
        userId: hcenterusers.userId,
        userName: hcenterusers.userName,
        firstName: hcenterusers.firstName,
        secondName: hcenterusers.secondName,
        thirdName: hcenterusers.thirdName,
        lastName: hcenterusers.lastName,
        userType: hcenterusers.userType,
        isAdmin: hcenterusers.isAdmin,
        isActive: hcenterusers.isActive,
      })
      .from(hcenterusers)
      .where(and(...filters))
      .orderBy(asc(hcenterusers.firstName));

    return rows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? "",
      fullName:
        [r.firstName, r.secondName, r.thirdName, r.lastName]
          .filter((x): x is string => !!x && x.trim().length > 0)
          .join(" ")
          .trim() || (r.userName ?? "—"),
      userType: r.userType,
      isAdmin: !!r.isAdmin,
      isActive: !!r.isActive,
    }));
  }
}
