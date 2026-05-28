import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { and, eq, like, or, sql } from "drizzle-orm";
import { medicalconditions } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";

export interface MedicalConditionSuggestion {
  medicalConditionId: string;
  name: string;
  category: string | null;
  isChronic: boolean;
  isAllergy: boolean;
  isHereditary: boolean;
  isVerified: boolean;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("medical-conditions")
export class MedicalConditionsController {
  constructor(private readonly tdb: TenantDbService) {}

  @Get()
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "category", required: false, description: "Filter: allergy | chronic | hereditary" })
  async search(
    @Query("q") q: string,
    @Query("limit") limit?: string,
    @Query("category") category?: string,
  ): Promise<MedicalConditionSuggestion[]> {
    const term = (q ?? "").trim();
    if (term.length < 2) {
      throw new BadRequestException("Provide at least 2 characters");
    }
    const lim = Math.min(50, Math.max(1, Number(limit) || 20));
    const escaped = term.replace(/[%_]/g, (m) => `\\${m}`);
    const likeArg = `%${escaped}%`;
    const prefix = `${escaped}%`;

    let categoryClause: ReturnType<typeof eq> | undefined;
    if (category === "allergy") categoryClause = eq(medicalconditions.isAllergy, 1);
    else if (category === "chronic") categoryClause = eq(medicalconditions.isChronic, 1);
    else if (category === "hereditary") categoryClause = eq(medicalconditions.isHereditary, 1);

    const where = and(
      or(
        like(medicalconditions.medicalConditionName, likeArg),
        like(medicalconditions.searchKeywords, likeArg),
      ),
      categoryClause,
    );

    const rows = await this.tdb.db
      .select({
        medicalConditionId: medicalconditions.medicalConditionId,
        name: medicalconditions.medicalConditionName,
        category: medicalconditions.categoryText,
        isChronic: medicalconditions.isChronic,
        isAllergy: medicalconditions.isAllergy,
        isHereditary: medicalconditions.isHereditary,
        isVerified: medicalconditions.isVerified,
      })
      .from(medicalconditions)
      .where(where)
      .orderBy(
        // Verified items first, then exact-prefix matches, then alphabetical.
        sql`${medicalconditions.isVerified} DESC,
            CASE WHEN ${medicalconditions.medicalConditionName} LIKE ${prefix} THEN 0 ELSE 1 END,
            ${medicalconditions.medicalConditionName} ASC`,
      )
      .limit(lim);

    return rows.map((r) => ({
      medicalConditionId: r.medicalConditionId,
      name: r.name,
      category: r.category ?? null,
      isChronic: !!r.isChronic,
      isAllergy: !!r.isAllergy,
      isHereditary: !!r.isHereditary,
      isVerified: !!r.isVerified,
    }));
  }
}
