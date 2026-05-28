import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hcenterscheduleitems,
  hcenterusers,
  patients,
  patientarabicinfo,
} from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import { VisitsService } from "../visits/visits.service";
import type {
  CreateScheduleDto,
  ListScheduleQueryDto,
  ScheduleListItem,
  UpdateScheduleDto,
} from "./dto/schedule.dto";

const FIELD_MAP: Record<
  keyof UpdateScheduleDto,
  { col: string; kind: "string-or-null" | "uuid-or-null" | "int" | "bool" | "date" }
> = {
  doctorId: { col: "doctor", kind: "uuid-or-null" },
  scheduledInDate: { col: "scheduledInDate", kind: "date" },
  scheduledToDate: { col: "scheduledToDate", kind: "date" },
  patientId: { col: "patientId", kind: "uuid-or-null" },
  name: { col: "name", kind: "string-or-null" },
  contactPhone: { col: "contactPhone", kind: "string-or-null" },
  contactEmail: { col: "contactEmail", kind: "string-or-null" },
  notes: { col: "notes", kind: "string-or-null" },
  location: { col: "location", kind: "string-or-null" },
  statusId: { col: "statusId", kind: "int" },
  labelId: { col: "labelId", kind: "int" },
  isSurgery: { col: "isSurgery", kind: "bool" },
  notForPatient: { col: "notForPatient", kind: "bool" },
  isVerified: { col: "isVerified", kind: "bool" },
  isDone: { col: "isDone", kind: "bool" },
};

@Injectable()
export class SchedulingService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async list(query: ListScheduleQueryDto): Promise<ScheduleListItem[]> {
    const from = formatMysqlDateTime(query.from);
    const to = formatMysqlDateTime(query.to);
    if (!from || !to) throw new BadRequestException("from/to must be valid ISO dates");

    const filters = [
      eq(hcenterscheduleitems.hcenterId, this.tdb.tenantId),
      gte(hcenterscheduleitems.scheduledInDate, from),
      lt(hcenterscheduleitems.scheduledInDate, to),
    ];
    if (query.doctorId) filters.push(eq(hcenterscheduleitems.doctor, query.doctorId));
    if (query.status) filters.push(eq(hcenterscheduleitems.statusId, query.status));

    const rows = await this.tdb.db
      .select({
        scheduleItemId: hcenterscheduleitems.hcenterScheduleItemId,
        scheduledInDate: hcenterscheduleitems.scheduledInDate,
        scheduledToDate: hcenterscheduleitems.scheduledToDate,
        statusId: hcenterscheduleitems.statusId,
        labelId: hcenterscheduleitems.labelId,
        isVerified: hcenterscheduleitems.isVerified,
        isDone: hcenterscheduleitems.isDone,
        isSurgery: hcenterscheduleitems.isSurgery,
        notForPatient: hcenterscheduleitems.notForPatient,
        location: hcenterscheduleitems.location,
        name: hcenterscheduleitems.name,
        notes: hcenterscheduleitems.notes,
        contactPhone: hcenterscheduleitems.contactPhone,
        contactEmail: hcenterscheduleitems.contactEmail,
        patientVisitId: hcenterscheduleitems.patientVisitId,
        // Joined columns
        doctorUserId: hcenterusers.userId,
        doctorFirst: hcenterusers.firstName,
        doctorSecond: hcenterusers.secondName,
        doctorThird: hcenterusers.thirdName,
        doctorLast: hcenterusers.lastName,
        patientId: patients.patientId,
        patientFirst: patients.firstName,
        patientSecond: patients.secondName,
        patientThird: patients.thirdName,
        patientLast: patients.lastName,
        patientNationalId: patients.nationalId,
        patientMobile: patients.mobileNumber,
        patientFirstAr: patientarabicinfo.firstNameAr,
        patientSecondAr: patientarabicinfo.secondNameAr,
        patientThirdAr: patientarabicinfo.thirdNameAr,
        patientLastAr: patientarabicinfo.lastNameAr,
      })
      .from(hcenterscheduleitems)
      .leftJoin(hcenterusers, eq(hcenterusers.userId, hcenterscheduleitems.doctor))
      .leftJoin(patients, eq(patients.patientId, hcenterscheduleitems.patientId))
      .leftJoin(patientarabicinfo, eq(patientarabicinfo.patientId, patients.patientId))
      .where(and(...filters))
      .orderBy(asc(hcenterscheduleitems.scheduledInDate));

    return rows.map((r) => {
      const enName = composeName([r.patientFirst, r.patientSecond, r.patientThird, r.patientLast]);
      const arName = composeName([
        r.patientFirstAr,
        r.patientSecondAr,
        r.patientThirdAr,
        r.patientLastAr,
      ]);
      return {
        scheduleItemId: r.scheduleItemId,
        scheduledInDate: r.scheduledInDate,
        scheduledToDate: r.scheduledToDate,
        statusId: r.statusId,
        labelId: r.labelId,
        isVerified: !!r.isVerified,
        isDone: !!r.isDone,
        isSurgery: !!r.isSurgery,
        notForPatient: !!r.notForPatient,
        location: r.location ?? null,
        name: r.name ?? null,
        notes: r.notes ?? null,
        contactPhone: r.contactPhone ?? null,
        contactEmail: r.contactEmail ?? null,
        doctor: r.doctorUserId
          ? {
              userId: r.doctorUserId,
              fullName:
                composeName([r.doctorFirst, r.doctorSecond, r.doctorThird, r.doctorLast]) || "—",
            }
          : null,
        patient: r.patientId
          ? {
              patientId: r.patientId,
              fullName: enName || arName,
              fullNameAr: arName || null,
              nationalId: r.patientNationalId ?? "",
              mobileNumber: r.patientMobile ?? null,
            }
          : null,
        patientVisitId: r.patientVisitId ?? null,
      };
    });
  }

  async create(dto: CreateScheduleDto): Promise<{ scheduleItemId: string }> {
    const scheduledIn = formatMysqlDateTime(dto.scheduledInDate);
    const scheduledTo = formatMysqlDateTime(dto.scheduledToDate);
    if (!scheduledIn || !scheduledTo) {
      throw new BadRequestException("Invalid scheduledInDate / scheduledToDate");
    }
    if (scheduledTo <= scheduledIn) {
      throw new BadRequestException("scheduledToDate must be after scheduledInDate");
    }

    await this.assertDoctorInTenant(dto.doctorId);
    if (!dto.notForPatient && dto.patientId) {
      await this.assertPatientInTenant(dto.patientId);
    }
    if (!dto.notForPatient && !dto.patientId) {
      throw new BadRequestException(
        "Either provide a patientId or set notForPatient=true for internal blockers",
      );
    }

    const id = randomUUID();
    await this.tdb.db.insert(hcenterscheduleitems).values({
      hcenterScheduleItemId: id,
      hcenterId: this.tdb.tenantId,
      scheduledInDate: scheduledIn,
      scheduledToDate: scheduledTo,
      doctor: dto.doctorId,
      patientId: dto.notForPatient ? null : dto.patientId ?? null,
      name: dto.name ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,
      notes: dto.notes ?? null,
      location: dto.location ?? null,
      statusId: dto.statusId ?? 1,
      labelId: dto.labelId ?? 1,
      isSurgery: dto.isSurgery ? 1 : 0,
      notForPatient: dto.notForPatient ? 1 : 0,
      isVerified: 0,
      isDone: 0,
      byDoctor: 0,
      addSchedulingOfficer: this.tenant.userId,
      addedDate: formatMysqlDateTime(new Date()) as string,
    });

    await this.audit.record({
      action: "Create",
      entityType: "ScheduleItem",
      entityId: id,
      patientContext: dto.patientId ?? null,
      newValues: {
        doctorId: dto.doctorId,
        patientId: dto.patientId ?? null,
        scheduledInDate: scheduledIn,
        scheduledToDate: scheduledTo,
        statusId: dto.statusId ?? 1,
        isSurgery: !!dto.isSurgery,
        notForPatient: !!dto.notForPatient,
      },
    });

    return { scheduleItemId: id };
  }

  async update(scheduleItemId: string, patch: UpdateScheduleDto): Promise<void> {
    const [current] = await this.tdb.db
      .select()
      .from(hcenterscheduleitems)
      .where(
        and(
          eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId),
          eq(hcenterscheduleitems.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Appointment ${scheduleItemId} not found`);

    if (patch.doctorId) await this.assertDoctorInTenant(patch.doctorId);
    if (patch.patientId) await this.assertPatientInTenant(patch.patientId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [field, spec] of Object.entries(FIELD_MAP) as Array<
      [keyof UpdateScheduleDto, (typeof FIELD_MAP)[keyof UpdateScheduleDto]]
    >) {
      const incoming = patch[field];
      if (incoming === undefined) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (current as Record<string, any>)[spec.col];
      const a = normalize(incoming, spec.kind);
      const b = normalize(existing, spec.kind);
      if (a === b) continue;
      setFields[spec.col] = a;
      previousValues[field] = b;
      newValues[field] = a;
      changedFields.push(field);
    }

    if (changedFields.length === 0) return;

    // Enforce ordering if either bound changes.
    const nextIn = (setFields.scheduledInDate ?? current.scheduledInDate) as string;
    const nextTo = (setFields.scheduledToDate ?? current.scheduledToDate) as string;
    if (nextTo <= nextIn) {
      throw new BadRequestException("scheduledToDate must be after scheduledInDate");
    }

    setFields.updatedDate = formatMysqlDateTime(new Date());
    setFields.updateSchedulingOfficer = this.tenant.userId;

    const result = await this.tdb.db
      .update(hcenterscheduleitems)
      .set(setFields)
      .where(eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId));
    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(
        `Expected to update 1 schedule row, but ${affected} were affected`,
      );
    }

    await this.audit.record({
      action: "Update",
      entityType: "ScheduleItem",
      entityId: scheduleItemId,
      patientContext: current.patientId ?? null,
      changedFields,
      previousValues,
      newValues,
    });
  }

  async delete(scheduleItemId: string): Promise<void> {
    const [current] = await this.tdb.db
      .select()
      .from(hcenterscheduleitems)
      .where(
        and(
          eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId),
          eq(hcenterscheduleitems.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Appointment ${scheduleItemId} not found`);

    await this.tdb.db
      .delete(hcenterscheduleitems)
      .where(eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId));

    await this.audit.record({
      action: "Delete",
      entityType: "ScheduleItem",
      entityId: scheduleItemId,
      patientContext: current.patientId ?? null,
      previousValues: {
        doctorId: current.doctor,
        patientId: current.patientId,
        scheduledInDate: current.scheduledInDate,
        scheduledToDate: current.scheduledToDate,
        statusId: current.statusId,
      },
    });
  }

  /**
   * Convert an appointment to a clinical visit. Creates the visit row (via
   * VisitsService), links it back on the appointment, advances status to
   * InProgress (4) and IsDone=1. Idempotent in the sense that re-calling on
   * an already-linked appointment returns the existing visit instead of
   * creating a duplicate.
   */
  async startVisit(
    scheduleItemId: string,
    options: { visitType?: number } = {},
  ): Promise<{ patientVisitId: string; alreadyExisted: boolean }> {
    const [appt] = await this.tdb.db
      .select()
      .from(hcenterscheduleitems)
      .where(
        and(
          eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId),
          eq(hcenterscheduleitems.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!appt) throw new NotFoundException(`Appointment ${scheduleItemId} not found`);

    // Already converted — return the existing visit id without doing more.
    if (appt.patientVisitId) {
      return { patientVisitId: appt.patientVisitId, alreadyExisted: true };
    }

    if (appt.notForPatient || !appt.patientId) {
      throw new BadRequestException(
        "Blocked slots can't be converted to a visit (no patient attached).",
      );
    }
    if (!appt.doctor) {
      throw new BadRequestException("Appointment has no doctor assigned.");
    }

    // Create the visit. The VisitsService validates tenant + doctor membership
    // and writes its own Create audit row.
    const { patientVisitId } = await this.visits.create({
      patientId: appt.patientId,
      doctorUserId: appt.doctor,
      visitType: options.visitType ?? 2, // Follow-up — most appointments are
      // Convert mariadb datetime back to ISO for the DTO.
      visitDate: parseStored(appt.scheduledInDate).toISOString(),
    });

    // Link + advance status atomically.
    await this.tdb.db
      .update(hcenterscheduleitems)
      .set({
        patientVisitId,
        statusId: 4, // InProgress
        isDone: 1,
        updatedDate: formatMysqlDateTime(new Date()),
        updateSchedulingOfficer: this.tenant.userId,
      })
      .where(eq(hcenterscheduleitems.hcenterScheduleItemId, scheduleItemId));

    await this.audit.record({
      action: "Update",
      entityType: "ScheduleItem",
      entityId: scheduleItemId,
      patientContext: appt.patientId,
      changedFields: ["patientVisitId", "statusId", "isDone"],
      previousValues: { patientVisitId: null, statusId: appt.statusId, isDone: !!appt.isDone },
      newValues: { patientVisitId, statusId: 4, isDone: true },
    });

    return { patientVisitId, alreadyExisted: false };
  }

  private async assertDoctorInTenant(userId: string): Promise<void> {
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
    if (!row) throw new BadRequestException(`Doctor ${userId} not in this HCenter`);
  }

  private async assertPatientInTenant(patientId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new BadRequestException(`Patient ${patientId} not in this HCenter`);
  }
}

function composeName(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(" ").trim();
}

function parseStored(v: string): Date {
  return new Date(v.includes(" ") ? v.replace(" ", "T") + "Z" : v);
}

function formatMysqlDateTime(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d =
    v instanceof Date
      ? v
      : new Date(typeof v === "string" && !v.includes("T") && !v.includes(" ") ? `${v}T00:00:00.000Z` : v);
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

function normalize(value: unknown, kind: (typeof FIELD_MAP)[keyof typeof FIELD_MAP]["kind"]): unknown {
  if (value === undefined) return null;
  switch (kind) {
    case "string-or-null":
    case "uuid-or-null": {
      if (value === null) return null;
      const s = String(value);
      return s.length === 0 ? null : s;
    }
    case "int": {
      if (value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case "bool": {
      return value ? 1 : 0;
    }
    case "date": {
      if (value === null) return null;
      // Both incoming (ISO) and existing (mysql datetime) sides normalised to ISO for compare.
      const t = String(value);
      if (t.length === 0) return null;
      const date = new Date(t.includes(" ") ? t.replace(" ", "T") + "Z" : t);
      if (Number.isNaN(date.getTime())) return t;
      // Re-emit as MariaDB datetime so SET values write cleanly.
      return formatMysqlDateTime(date);
    }
  }
}
