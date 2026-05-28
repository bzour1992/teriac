import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiQuery } from "@nestjs/swagger";
import { and, or, like, eq, sql } from "drizzle-orm";
import { medicines, countries } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";

export interface MedicineSuggestion {
  medicineId: string;
  tradeName: string;
  scientificName: string | null;
  countryCode: string | null;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("medicines")
export class MedicinesController {
  constructor(private readonly tdb: TenantDbService) {}

  @Get()
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "limit", required: false })
  async search(
    @Query("q") q: string,
    @Query("limit") limit?: string,
  ): Promise<MedicineSuggestion[]> {
    const term = (q ?? "").trim();
    if (term.length < 2) {
      throw new BadRequestException("Provide at least 2 characters for medicine search");
    }
    const lim = Math.min(50, Math.max(1, Number(limit) || 20));
    const escaped = term.replace(/[%_]/g, (m) => `\\${m}`);
    const likeArg = `%${escaped}%`;
    // We bias the result so that an exact-prefix match on TradeName ranks first.
    const prefix = `${escaped}%`;

    const rows = await this.tdb.db
      .select({
        medicineId: medicines.medicineId,
        tradeName: medicines.tradeName,
        scientificName: medicines.scientificName,
        countryCode: countries.countryCodeIso2,
      })
      .from(medicines)
      .leftJoin(countries, eq(countries.countryId, medicines.countryId))
      .where(
        and(
          or(
            like(medicines.tradeName, likeArg),
            like(medicines.scientificName, likeArg),
          ),
        ),
      )
      .orderBy(
        sql`CASE
              WHEN ${medicines.tradeName} LIKE ${prefix} THEN 0
              WHEN ${medicines.scientificName} LIKE ${prefix} THEN 1
              ELSE 2
            END, ${medicines.tradeName} ASC`,
      )
      .limit(lim);

    return rows.map((r) => ({
      medicineId: r.medicineId,
      tradeName: r.tradeName ?? r.scientificName ?? "—",
      scientificName: r.scientificName ?? null,
      countryCode: r.countryCode ?? null,
    }));
  }
}
