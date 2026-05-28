import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { IsString } from "class-validator";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { and, eq, like, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { icd10Cm2012, medicalconditions } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantDbService } from "../../db/tenant-db.service";

interface Icd10Result {
  icd10Id: number;
  code: string;
  shortDesc: string;
  longDesc: string | null;
  billable: boolean;
}

class ResolveIcd10Body {
  @IsString()
  code!: string;

  @IsString()
  shortDesc!: string;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("coding/icd10")
export class Icd10Controller {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tdb: TenantDbService,
  ) {}

  @Get()
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "billableOnly", required: false })
  async search(
    @Query("q") q: string,
    @Query("limit") limit?: string,
    @Query("billableOnly") billableOnly?: string,
  ): Promise<Icd10Result[]> {
    if (!q || q.trim().length < 2) return [];

    const maxRows = Math.min(Number(limit) || 20, 50);
    const qTrimmed = q.trim().toUpperCase();
    const filters = [];

    // Code-first: if input looks like an ICD code (letter + digit), prioritise prefix match.
    const isCodePattern = /^[A-Z]\d/i.test(qTrimmed);
    if (isCodePattern) {
      filters.push(
        or(
          like(icd10Cm2012.code, `${qTrimmed}%`),
          like(sql`TRIM(${icd10Cm2012.shortDesc})`, `%${q.trim()}%`),
        ),
      );
    } else {
      // TRIM() handles legacy ShortDesc values padded with trailing spaces.
      filters.push(like(sql`TRIM(${icd10Cm2012.shortDesc})`, `%${q.trim()}%`));
    }

    if (billableOnly === "true" || billableOnly === "1") {
      // The legacy DB uses Type=1 for non-billable headers; all other type
      // values (2, 10, …) represent billable codes from different import batches.
      filters.push(ne(icd10Cm2012.type, 1));
    }

    const rows = await this.db
      .select({
        icd10Id: icd10Cm2012.icd10Id,
        code: icd10Cm2012.code,
        shortDesc: icd10Cm2012.shortDesc,
        longDesc: icd10Cm2012.longDesc,
        type: icd10Cm2012.type,
      })
      .from(icd10Cm2012)
      .where(and(...filters))
      .orderBy(icd10Cm2012.code)
      .limit(maxRows);

    return rows.map((r) => ({
      icd10Id: r.icd10Id,
      code: r.code,
      shortDesc: (r.shortDesc ?? "").trim(),
      longDesc: r.longDesc ? r.longDesc.trim() : null,
      // Type=1 = non-billable header; everything else is considered billable.
      billable: r.type !== 1,
    }));
  }

  /**
   * Find or create a `medicalconditions` row for the given ICD-10 code so the
   * caller gets a `medicalConditionId` to use in `pvassessmentconditions`.
   *
   * Strategy:
   *  1. Exact match on MedicalConditionName = shortDesc
   *  2. Exact match on SearchKeywords containing the code
   *  3. Create a new row tagged with the code in SearchKeywords
   */
  @Post("resolve")
  async resolve(
    @Body() body: ResolveIcd10Body,
  ): Promise<{ medicalConditionId: string; conditionName: string; icd10Code: string }> {
    const { code, shortDesc } = body;
    const name = shortDesc.trim();
    const codeUpper = code.trim().toUpperCase();

    // 1. Try exact name match
    const [byName] = await this.db
      .select({ id: medicalconditions.medicalConditionId, n: medicalconditions.medicalConditionName })
      .from(medicalconditions)
      .where(eq(medicalconditions.medicalConditionName, name))
      .limit(1);
    if (byName) {
      return { medicalConditionId: byName.id, conditionName: byName.n, icd10Code: codeUpper };
    }

    // 2. Try keyword match on code
    const [byCode] = await this.db
      .select({ id: medicalconditions.medicalConditionId, n: medicalconditions.medicalConditionName })
      .from(medicalconditions)
      .where(like(medicalconditions.searchKeywords, `%${codeUpper}%`))
      .limit(1);
    if (byCode) {
      return { medicalConditionId: byCode.id, conditionName: byCode.n, icd10Code: codeUpper };
    }

    // 3. Auto-create — unverified, tagged with the ICD code as a keyword.
    const id = randomUUID();
    await this.db.insert(medicalconditions).values({
      medicalConditionId: id,
      medicalConditionName: name,
      isAllergy: 0,
      isHereditary: 0,
      isChronic: 0,
      isVerified: 0,
      addedBy: "ICD-10",
      searchKeywords: codeUpper,
      dateAdded: fmtDate(new Date()),
    });

    return { medicalConditionId: id, conditionName: name, icd10Code: codeUpper };
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
