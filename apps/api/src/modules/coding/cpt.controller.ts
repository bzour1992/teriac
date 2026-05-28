import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { and, eq, like, or } from "drizzle-orm";
import { cptcodes } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";

interface CptResult {
  cptCodeId: string;
  cptCode: string;
  shortDescription: string;
  longDescription: string | null;
  sgroup: string | null;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("coding/cpt")
export class CptController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "limit", required: false })
  async search(
    @Query("q") q: string,
    @Query("limit") limit?: string,
  ): Promise<CptResult[]> {
    if (!q || q.trim().length < 2) return [];

    const maxRows = Math.min(Number(limit) || 20, 50);
    const qTrimmed = q.trim();

    // If query looks like a CPT code (5 digits or starts with digits), prioritise code match.
    const isCodePattern = /^\d/.test(qTrimmed);
    const filter = isCodePattern
      ? or(
          like(cptcodes.cptCode, `${qTrimmed}%`),
          like(cptcodes.shortDescription, `%${qTrimmed}%`),
        )
      : or(
          like(cptcodes.shortDescription, `%${qTrimmed}%`),
          like(cptcodes.longDescription, `%${qTrimmed}%`),
        );

    const rows = await this.db
      .select({
        cptCodeId: cptcodes.cptCodeId,
        cptCode: cptcodes.cptCode,
        shortDescription: cptcodes.shortDescription,
        longDescription: cptcodes.longDescription,
        sgroup: cptcodes.sgroup,
      })
      .from(cptcodes)
      .where(filter)
      .orderBy(cptcodes.cptCode)
      .limit(maxRows);

    return rows.map((r) => ({
      cptCodeId: r.cptCodeId,
      cptCode: r.cptCode ?? "",
      shortDescription: r.shortDescription ?? "",
      longDescription: r.longDescription ?? null,
      sgroup: r.sgroup ?? null,
    }));
  }
}
