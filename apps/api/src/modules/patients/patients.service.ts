import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql, or, like, count, desc, max } from "drizzle-orm";
import {
  patients,
  patientarabicinfo,
  patientadditionalinfo,
  allergies,
  chronicdiseases,
  patientlongtermmedicines,
  patientproblems,
  patientinsurancedetails,
  patientvisits,
  patientspecialnotes,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { UpdatePatientDto } from "./dto/update-patient.dto";
import type { CreatePatientDto } from "./dto/create-patient.dto";
import { randomUUID } from "node:crypto";
import type {
  ListPatientsQueryDto,
  PatientListItem,
  PatientListResponse,
} from "./dto/list-patients.dto";
import type { PatientDetail } from "./dto/patient-detail.dto";

@Injectable()
export class PatientsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPatientsQueryDto): Promise<PatientListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const search = query.q?.trim();

    const tenantClause = this.tdb.tenantClause(patients);

    let searchClause: ReturnType<typeof or> | undefined;
    if (search) {
      const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
      const like1 = `%${escaped}%`;
      searchClause = or(
        like(patients.firstName, like1),
        like(patients.secondName, like1),
        like(patients.thirdName, like1),
        like(patients.lastName, like1),
        like(patients.nationalId, like1),
        like(patients.mobileNumber, like1),
        like(patients.email, like1),
        like(patientarabicinfo.firstNameAr, like1),
        like(patientarabicinfo.lastNameAr, like1),
      );
    }

    const where = and(tenantClause, eq(patients.isDeleted, 0), searchClause);

    const [{ value: total }] = await this.tdb.db
      .select({ value: count() })
      .from(patients)
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .where(where);

    const rows = await this.tdb.db
      .select({
        patientId: patients.patientId,
        nationalId: patients.nationalId,
        firstName: patients.firstName,
        secondName: patients.secondName,
        thirdName: patients.thirdName,
        lastName: patients.lastName,
        firstNameAr: patientarabicinfo.firstNameAr,
        secondNameAr: patientarabicinfo.secondNameAr,
        thirdNameAr: patientarabicinfo.thirdNameAr,
        lastNameAr: patientarabicinfo.lastNameAr,
        sex: patients.sex,
        dateOfBirth: patients.dateOfBirth,
        mobileNumber: patients.mobileNumber,
        email: patients.email,
        photoFilename: patients.photoFilename,
      })
      .from(patients)
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .where(where)
      .orderBy(sql`COALESCE(${patients.firstName}, ${patientarabicinfo.firstNameAr}, '') ASC`)
      .limit(pageSize)
      .offset(offset);

    const data: PatientListItem[] = rows.map((r) => {
      const enName = composeName([r.firstName, r.secondName, r.thirdName, r.lastName]);
      const arName = composeName([r.firstNameAr, r.secondNameAr, r.thirdNameAr, r.lastNameAr]);
      return {
        patientId: r.patientId,
        nationalId: r.nationalId,
        // Fall back to Arabic if English is missing — many older records have only AR.
        fullName: enName || arName,
        fullNameAr: arName || null,
        sex: r.sex,
        dateOfBirth: r.dateOfBirth ?? null,
        mobileNumber: r.mobileNumber ?? null,
        email: r.email ?? null,
        photoUrl: r.photoFilename ? `/v1/patients/${r.patientId}/photo` : null,
      };
    });

    await this.audit.record({
      action: "View",
      entityType: "PatientList",
      newValues: { q: search ?? null, page, pageSize, returned: data.length, total },
    });

    return { data, total, page, pageSize };
  }

  async getById(patientId: string): Promise<PatientDetail> {
    const rows = await this.tdb.db
      .select({
        p: patients,
        ar: patientarabicinfo,
        ad: patientadditionalinfo,
      })
      .from(patients)
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .leftJoin(patientadditionalinfo, eq(patientadditionalinfo.patientId, patients.patientId))
      .where(this.tdb.scoped(patients, eq(patients.patientId, patientId), eq(patients.isDeleted, 0)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
    const p = row.p;
    const ar = row.ar;
    const ad = row.ad;

    const enName = composeName([p.firstName, p.secondName, p.thirdName, p.lastName]);
    const arName = composeName([ar?.firstNameAr, ar?.secondNameAr, ar?.thirdNameAr, ar?.lastNameAr]);

    // Summary counts — six small queries, all keyed by PatientID. With the §8
    // indexes added in migration 0002 these complete in single-digit ms.
    const [
      [allergyAgg],
      [chronicAgg],
      [ltmAgg],
      [problemAgg],
      [insuranceAgg],
      [visitAgg],
    ] = await Promise.all([
      this.tdb.db.select({ n: count() }).from(allergies).where(eq(allergies.patientId, p.patientId)),
      this.tdb.db
        .select({ n: count() })
        .from(chronicdiseases)
        .where(eq(chronicdiseases.patientId, p.patientId)),
      this.tdb.db
        .select({ n: count() })
        .from(patientlongtermmedicines)
        .where(eq(patientlongtermmedicines.patientId, p.patientId)),
      this.tdb.db
        .select({ n: count() })
        .from(patientproblems)
        .where(and(eq(patientproblems.patientId, p.patientId), eq(patientproblems.isActive, 1))),
      this.tdb.db
        .select({ n: count() })
        .from(patientinsurancedetails)
        .where(
          and(
            eq(patientinsurancedetails.patientId, p.patientId),
            eq(patientinsurancedetails.isActive, 1),
          ),
        ),
      this.tdb.db
        .select({ n: count(), last: max(patientvisits.visitDate) })
        .from(patientvisits)
        .where(and(eq(patientvisits.patientId, p.patientId), eq(patientvisits.isDeleted, 0))),
    ]);

    const recentVisits = await this.tdb.db
      .select({
        patientVisitId: patientvisits.patientVisitId,
        visitDate: patientvisits.visitDate,
        chiefComplaint: patientvisits.chiefComplaint,
        outcome: patientvisits.outcome,
      })
      .from(patientvisits)
      .where(and(eq(patientvisits.patientId, p.patientId), eq(patientvisits.isDeleted, 0)))
      .orderBy(desc(patientvisits.visitDate))
      .limit(5);

    const notes = await this.tdb.db
      .select({
        patientSpecialNoteId: patientspecialnotes.patientSpecialNoteId,
        note: patientspecialnotes.note,
      })
      .from(patientspecialnotes)
      .where(eq(patientspecialnotes.patientId, p.patientId));

    const detail: PatientDetail = {
      patientId: p.patientId,
      nationalId: p.nationalId,
      prefix: p.prefix ?? null,
      firstName: p.firstName ?? null,
      secondName: p.secondName ?? null,
      thirdName: p.thirdName ?? null,
      lastName: p.lastName ?? null,
      fullName: enName || arName,
      fullNameAr: arName || null,
      sex: p.sex,
      dateOfBirth: p.dateOfBirth ?? null,
      age: ageOf(p.dateOfBirth),
      height: p.height ?? null,
      weight: p.weight ?? null,
      whUnit: p.whUnit ?? null,
      mobileNumber: p.mobileNumber ?? null,
      email: p.email ?? null,
      address: p.address ?? null,
      photoUrl: p.photoFilename ? `/v1/patients/${p.patientId}/photo` : null,
      passportNumber: p.passportNumber ?? null,
      nationality: p.nationality ?? null,
      humanRaceId: p.humanRaceId ?? null,
      maritalStatusId: p.maritalStatusId ?? null,
      schoolPerformance: p.schoolPerformance,
      fatherEducation: p.fatherEducation ?? null,
      fatherOccupation: p.fatherOccupation ?? null,
      motherEducation: p.motherEducation ?? null,
      motherOccupation: p.motherOccupation ?? null,
      childOrder: p.childOrder ?? null,
      childrenCount: p.childrenCount ?? null,
      dateAdded: p.dateAdded ?? null,
      patientCreationMethod: p.patientCreationMethod,
      arabicInfo: ar
        ? {
            firstNameAr: ar.firstNameAr ?? null,
            secondNameAr: ar.secondNameAr ?? null,
            thirdNameAr: ar.thirdNameAr ?? null,
            lastNameAr: ar.lastNameAr ?? null,
          }
        : null,
      additionalInfo: ad
        ? {
            occupation: ad.occupation ?? null,
            organization: ad.organization ?? null,
            poBox: ad.poBox ?? null,
            zipCode: ad.zipCode ?? null,
            homeEnvironment: ad.homeEnvironment ?? null,
          }
        : null,
      emergencyContact: {
        name: p.contactPersonName ?? null,
        relation: p.contactRelation ?? null,
        phoneNumber: p.contactPhoneNumber ?? null,
      },
      summary: {
        allergyCount: Number(allergyAgg?.n ?? 0),
        chronicDiseaseCount: Number(chronicAgg?.n ?? 0),
        longTermMedicationCount: Number(ltmAgg?.n ?? 0),
        activeProblemCount: Number(problemAgg?.n ?? 0),
        activeInsuranceCount: Number(insuranceAgg?.n ?? 0),
        visitCount: Number(visitAgg?.n ?? 0),
        lastVisitDate: visitAgg?.last ?? null,
      },
      recentVisits: recentVisits.map((v) => ({
        patientVisitId: v.patientVisitId,
        visitDate: v.visitDate,
        chiefComplaint: v.chiefComplaint ?? null,
        outcome: v.outcome,
      })),
      specialNotes: notes,
    };

    await this.audit.record({
      action: "View",
      entityType: "Patient",
      entityId: p.patientId,
      patientContext: p.patientId,
    });

    return detail;
  }

  /**
   * Register a new patient under the current tenant. Inserts the master row
   * and, if any Arabic name is supplied, the `patientarabicinfo` 1:1 extension.
   * Refuses duplicate (HCenterID, NationalID) pairs with a 409 — the legacy DB
   * doesn't have a UNIQUE constraint here (NationalID was historically used
   * as year-of-birth, see scripts/audit/SUMMARY.md), but a fresh registration
   * via this endpoint should never reuse one.
   */
  async create(dto: CreatePatientDto): Promise<{ patientId: string }> {
    const hcenterId = this.tdb.tenantId;

    // `nationalId` and `dateOfBirth` are NOT NULL columns at the DB level
    // (legacy schema). When the per-clinic field-rule editor marks them
    // optional the SPA may submit them empty/missing — we fall back to safe
    // sentinels so the row still inserts. Reports and dedupe must treat
    // "AUTO-…" IDs and the 1900-01-01 DOB as "unknown".
    const trimmedNid = (dto.nationalId ?? "").trim();
    const effectiveNid =
      trimmedNid.length > 0 ? trimmedNid : `AUTO-${randomUUID().slice(0, 8).toUpperCase()}`;

    // Soft uniqueness guard within the tenant. Only blocks live patients —
    // we allow re-registering a previously soft-deleted ID. Auto-generated
    // IDs are globally unique (UUID-based) so the check is a no-op for them.
    if (trimmedNid.length > 0) {
      const [existing] = await this.tdb.db
        .select({ id: patients.patientId })
        .from(patients)
        .where(
          and(
            eq(patients.hcenterId, hcenterId),
            eq(patients.nationalId, trimmedNid),
            eq(patients.isDeleted, 0),
          ),
        )
        .limit(1);
      if (existing) {
        throw new ConflictException(
          `A patient with NationalID '${trimmedNid}' already exists in this HCenter`,
        );
      }
    }

    const id = randomUUID();
    // Drizzle's datetime columns are mode='string' (MariaDB datetime(3)) and
    // expect 'YYYY-MM-DD HH:MM:SS.fff' — not ISO 8601 with T/Z. Format both.
    // Missing DOB → 1900-01-01 sentinel so the legacy NOT NULL column accepts it.
    const dob = formatMysqlDateTime(dto.dateOfBirth || "1900-01-01") as string;
    const nowMysql = formatMysqlDateTime(new Date()) as string;

    await this.tdb.db.insert(patients).values({
      patientId: id,
      hcenterId,
      nationalId: effectiveNid,
      sex: dto.sex,
      dateOfBirth: dob,
      prefix: nonEmptyStr(dto.prefix),
      firstName: nonEmptyStr(dto.firstName),
      secondName: nonEmptyStr(dto.secondName),
      thirdName: nonEmptyStr(dto.thirdName),
      lastName: nonEmptyStr(dto.lastName),
      passportNumber: nonEmptyStr(dto.passportNumber),
      religion: nonEmptyStr(dto.religion),
      nationality: nonEmptyStr(dto.nationality),
      humanRaceId: nonEmptyStr(dto.humanRaceId),
      maritalStatusId: nonEmptyStr(dto.maritalStatusId),
      mobileNumber: nonEmptyStr(dto.mobileNumber),
      email: nonEmptyStr(dto.email),
      address: nonEmptyStr(dto.address),
      contactPersonName: nonEmptyStr(dto.contactPersonName),
      contactRelation: nonEmptyStr(dto.contactRelation),
      contactPhoneNumber: nonEmptyStr(dto.contactPhoneNumber),
      schoolPerformance: 0,
      patientCreationMethod: 1, // Manual
      isDeleted: 0,
      dateAdded: nowMysql,
    });

    const hasArabic =
      nonEmptyStr(dto.firstNameAr) ||
      nonEmptyStr(dto.secondNameAr) ||
      nonEmptyStr(dto.thirdNameAr) ||
      nonEmptyStr(dto.lastNameAr);

    if (hasArabic) {
      await this.tdb.db.insert(patientarabicinfo).values({
        patientId: id,
        firstNameAr: nonEmptyStr(dto.firstNameAr),
        secondNameAr: nonEmptyStr(dto.secondNameAr),
        thirdNameAr: nonEmptyStr(dto.thirdNameAr),
        lastNameAr: nonEmptyStr(dto.lastNameAr),
      });
    }

    await this.audit.record({
      action: "Create",
      entityType: "Patient",
      entityId: id,
      patientContext: id,
      newValues: {
        nationalId: effectiveNid,
        sex: dto.sex,
        dateOfBirth: dob,
        firstName: nonEmptyStr(dto.firstName),
        lastName: nonEmptyStr(dto.lastName),
        firstNameAr: nonEmptyStr(dto.firstNameAr),
        lastNameAr: nonEmptyStr(dto.lastNameAr),
        mobileNumber: nonEmptyStr(dto.mobileNumber),
        email: nonEmptyStr(dto.email),
        creationMethod: "Manual",
      },
    });

    return { patientId: id };
  }

  /**
   * Update patient demographics + emergency contact + vitals baseline +
   * (1:1) Arabic name extension. Diff-only — only changed columns get written.
   * Audit row consolidates master + Arabic changes under a single Update.
   *
   * Note: `patientarabicinfo` is a 1:1 extension keyed by PatientID. If the row
   * doesn't exist and any Arabic name is set, we INSERT it; if it exists and
   * any value changes, we UPDATE it.
   */
  async update(patientId: string, patch: UpdatePatientDto): Promise<void> {
    // Pull master + extension under tenant scope. Errors out 404 if missing/foreign.
    const [row] = await this.tdb.db
      .select({ p: patients, ar: patientarabicinfo })
      .from(patients)
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);
    const current = row.p;
    const currentAr = row.ar;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setMaster: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setAr: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    // Master-table fields. Map DTO → DB column key + normaliser.
    const MASTER: Array<
      [keyof UpdatePatientDto, string, "string-or-null" | "string" | "int" | "double-or-null" | "uuid-or-null" | "date-or-null"]
    > = [
      ["prefix", "prefix", "string-or-null"],
      ["firstName", "firstName", "string-or-null"],
      ["secondName", "secondName", "string-or-null"],
      ["thirdName", "thirdName", "string-or-null"],
      ["lastName", "lastName", "string-or-null"],
      ["nationalId", "nationalId", "string"],
      ["sex", "sex", "int"],
      ["dateOfBirth", "dateOfBirth", "date-or-null"],
      ["passportNumber", "passportNumber", "string-or-null"],
      ["religion", "religion", "string-or-null"],
      ["nationality", "nationality", "uuid-or-null"],
      ["humanRaceId", "humanRaceId", "uuid-or-null"],
      ["maritalStatusId", "maritalStatusId", "uuid-or-null"],
      ["mobileNumber", "mobileNumber", "string-or-null"],
      ["email", "email", "string-or-null"],
      ["address", "address", "string-or-null"],
      ["contactPersonName", "contactPersonName", "string-or-null"],
      ["contactRelation", "contactRelation", "string-or-null"],
      ["contactPhoneNumber", "contactPhoneNumber", "string-or-null"],
      ["height", "height", "double-or-null"],
      ["weight", "weight", "double-or-null"],
      ["whUnit", "whUnit", "string-or-null"],
    ];

    for (const [field, col, kind] of MASTER) {
      const incoming = patch[field];
      if (incoming === undefined) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (current as Record<string, any>)[col];
      const a = normalizePatch(incoming, kind);
      const b = normalizePatch(existing, kind);
      if (a === b) continue;
      // Required-non-null fields (NationalID, DOB, Sex) reject null.
      if ((kind === "string" || kind === "int") && a === null) {
        throw new ConflictException(`${field} cannot be null`);
      }
      setMaster[col] = a;
      previousValues[field] = b;
      newValues[field] = a;
      changedFields.push(field);
    }

    // Arabic 1:1 extension.
    const AR_FIELDS: Array<[keyof UpdatePatientDto, string]> = [
      ["firstNameAr", "firstNameAr"],
      ["secondNameAr", "secondNameAr"],
      ["thirdNameAr", "thirdNameAr"],
      ["lastNameAr", "lastNameAr"],
    ];
    let arabicChanged = false;
    for (const [field, col] of AR_FIELDS) {
      const incoming = patch[field];
      if (incoming === undefined) continue;
      const a = normalizePatch(incoming, "string-or-null");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = currentAr ? normalizePatch((currentAr as Record<string, any>)[col], "string-or-null") : null;
      if (a === b) continue;
      setAr[col] = a;
      previousValues[field] = b;
      newValues[field] = a;
      changedFields.push(field);
      arabicChanged = true;
    }

    if (changedFields.length === 0) return;

    // Apply master update.
    if (Object.keys(setMaster).length > 0) {
      const result = await this.tdb.db
        .update(patients)
        .set(setMaster)
        .where(eq(patients.patientId, patientId));
      const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
      if (affected !== null && affected !== 1) {
        throw new ConflictException(
          `Expected to update 1 patient row, but ${affected} were affected`,
        );
      }
    }

    // Upsert patientarabicinfo if needed.
    if (arabicChanged) {
      if (currentAr) {
        await this.tdb.db
          .update(patientarabicinfo)
          .set(setAr)
          .where(eq(patientarabicinfo.patientId, patientId));
      } else {
        await this.tdb.db.insert(patientarabicinfo).values({
          patientId,
          ...setAr,
        });
      }
    }

    await this.audit.record({
      action: "Update",
      entityType: "Patient",
      entityId: patientId,
      patientContext: patientId,
      changedFields,
      previousValues,
      newValues,
    });
  }
}

function composeName(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(" ").trim();
}

function nonEmptyStr(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}

/**
 * Format a value for a MariaDB `datetime(3)` column. Drizzle exposes these as
 * `mode: 'string'`, and the legacy app stores them as 'YYYY-MM-DD HH:MM:SS.fff'.
 * ISO 8601 with T/Z works in some MySQL builds but breaks the prepared-statement
 * path mysql2 uses — keep the legacy shape to stay safe.
 */
function formatMysqlDateTime(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(typeof v === "string" && !v.includes("T") && !v.includes(" ") ? `${v}T00:00:00.000Z` : v);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${ms}`;
}

function ageOf(iso: string | null | undefined): { years: number; months: number } | null {
  if (!iso) return null;
  const dob = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months };
}

// Used by patient PATCH to normalise both incoming and existing values so the
// diff comparison is stable regardless of mysql2's return type quirks.
function normalizePatch(
  value: unknown,
  kind:
    | "string"
    | "string-or-null"
    | "int"
    | "double-or-null"
    | "uuid-or-null"
    | "date-or-null",
): unknown {
  if (value === undefined) return null;
  switch (kind) {
    case "string": {
      if (value === null) return null;
      return String(value);
    }
    case "string-or-null":
    case "uuid-or-null": {
      if (value === null) return null;
      const s = String(value);
      return s.length === 0 ? null : s;
    }
    case "int": {
      if (value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : Math.trunc(n);
    }
    case "double-or-null": {
      if (value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case "date-or-null": {
      if (value === null) return null;
      const t = String(value);
      if (t.length === 0) return null;
      const date = new Date(t.includes(" ") ? t.replace(" ", "T") + "Z" : t);
      return Number.isNaN(date.getTime()) ? t : date.toISOString();
    }
  }
}
