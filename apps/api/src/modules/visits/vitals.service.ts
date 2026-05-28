import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hcenterusers, patientvisits, patients, pvvitals } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import type { PatientVitalsRecord, SaveVitalsDto, VitalsRecord } from "./dto/vitals.dto";

@Injectable()
export class VitalsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(visitId: string): Promise<VitalsRecord[]> {
    await this.assertVisitInTenant(visitId);

    const rows = await this.tdb.db
      .select({
        pvVitalsId:      pvvitals.pvVitalsId,
        recordedAt:      pvvitals.recordedAt,
        heightCm:        pvvitals.heightCm,
        weightKg:        pvvitals.weightKg,
        bmi:             pvvitals.bmi,
        sbp:             pvvitals.sbp,
        dbp:             pvvitals.dbp,
        pulseRate:       pvvitals.pulseRate,
        temperatureC:    pvvitals.temperatureC,
        respiratoryRate: pvvitals.respiratoryRate,
        spo2:            pvvitals.spo2,
        notes:           pvvitals.notes,
        recorderFirst:   hcenterusers.firstName,
        recorderLast:    hcenterusers.lastName,
      })
      .from(pvvitals)
      .leftJoin(hcenterusers, eq(hcenterusers.userId, pvvitals.recordedByUserId))
      .where(eq(pvvitals.patientVisitId, visitId))
      .orderBy(desc(pvvitals.recordedAt));

    return rows.map((r) => ({
      pvVitalsId:      r.pvVitalsId,
      recordedAt:      r.recordedAt,
      recordedBy:      [r.recorderFirst, r.recorderLast].filter(Boolean).join(" ") || null,
      heightCm:        r.heightCm ?? null,
      weightKg:        r.weightKg ?? null,
      bmi:             r.bmi ?? null,
      sbp:             r.sbp ?? null,
      dbp:             r.dbp ?? null,
      pulseRate:       r.pulseRate ?? null,
      temperatureC:    r.temperatureC ?? null,
      respiratoryRate: r.respiratoryRate ?? null,
      spo2:            r.spo2 ?? null,
      notes:           r.notes ?? null,
    }));
  }

  /**
   * Returns every vitals record for one patient across all of their visits,
   * ordered by `RecordedAt` ASC so trend charts can render left-to-right.
   * Tenant-scoped via the patient's HCenterID.
   */
  async listForPatient(patientId: string, limit = 200): Promise<PatientVitalsRecord[]> {
    // Confirm the patient belongs to the tenant before exposing any vitals.
    const owned = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(
        and(
          eq(patients.patientId, patientId),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (owned.length === 0) throw new NotFoundException(`Patient ${patientId} not found`);

    const rows = await this.tdb.db
      .select({
        pvVitalsId:      pvvitals.pvVitalsId,
        recordedAt:      pvvitals.recordedAt,
        patientVisitId:  pvvitals.patientVisitId,
        visitDate:       patientvisits.visitDate,
        heightCm:        pvvitals.heightCm,
        weightKg:        pvvitals.weightKg,
        bmi:             pvvitals.bmi,
        sbp:             pvvitals.sbp,
        dbp:             pvvitals.dbp,
        pulseRate:       pvvitals.pulseRate,
        temperatureC:    pvvitals.temperatureC,
        respiratoryRate: pvvitals.respiratoryRate,
        spo2:            pvvitals.spo2,
        notes:           pvvitals.notes,
        recorderFirst:   hcenterusers.firstName,
        recorderLast:    hcenterusers.lastName,
      })
      .from(pvvitals)
      .innerJoin(patientvisits, eq(patientvisits.patientVisitId, pvvitals.patientVisitId))
      .leftJoin(hcenterusers, eq(hcenterusers.userId, pvvitals.recordedByUserId))
      .where(
        and(
          eq(patientvisits.patientId, patientId),
          eq(patientvisits.isDeleted, 0),
        ),
      )
      .orderBy(pvvitals.recordedAt)
      .limit(limit);

    return rows.map((r) => ({
      pvVitalsId:      r.pvVitalsId,
      recordedAt:      r.recordedAt,
      patientVisitId:  r.patientVisitId,
      visitDate:       r.visitDate,
      recordedBy:      [r.recorderFirst, r.recorderLast].filter(Boolean).join(" ") || null,
      heightCm:        r.heightCm ?? null,
      weightKg:        r.weightKg ?? null,
      bmi:             r.bmi ?? null,
      sbp:             r.sbp ?? null,
      dbp:             r.dbp ?? null,
      pulseRate:       r.pulseRate ?? null,
      temperatureC:    r.temperatureC ?? null,
      respiratoryRate: r.respiratoryRate ?? null,
      spo2:            r.spo2 ?? null,
      notes:           r.notes ?? null,
    }));
  }

  async record(visitId: string, dto: SaveVitalsDto): Promise<{ pvVitalsId: string }> {
    const visit = await this.assertVisitInTenant(visitId);

    const bmi = computeBmi(dto.heightCm, dto.weightKg);
    const id = randomUUID();
    const now = fmtDate(new Date());

    await this.tdb.db.insert(pvvitals).values({
      pvVitalsId:      id,
      patientVisitId:  visitId,
      recordedAt:      now,
      recordedByUserId: this.tenant.userId,
      heightCm:        dto.heightCm ?? null,
      weightKg:        dto.weightKg ?? null,
      bmi:             bmi,
      sbp:             dto.sbp ?? null,
      dbp:             dto.dbp ?? null,
      pulseRate:       dto.pulseRate ?? null,
      temperatureC:    dto.temperatureC ?? null,
      respiratoryRate: dto.respiratoryRate ?? null,
      spo2:            dto.spo2 ?? null,
      notes:           dto.notes?.trim() ?? null,
    });

    await this.audit.record({
      action: "Create",
      entityType: "Vitals",
      entityId: id,
      patientContext: visit.patientId,
      newValues: {
        visitId,
        sbp: dto.sbp, dbp: dto.dbp, pulse: dto.pulseRate,
        temp: dto.temperatureC, spo2: dto.spo2,
        height: dto.heightCm, weight: dto.weightKg, bmi,
      },
    });

    return { pvVitalsId: id };
  }

  private async assertVisitInTenant(visitId: string): Promise<{ patientId: string }> {
    const [row] = await this.tdb.db
      .select({ patientId: patients.patientId })
      .from(patientvisits)
      .innerJoin(patients, eq(patients.patientId, patientvisits.patientId))
      .where(
        and(
          eq(patientvisits.patientVisitId, visitId),
          eq(patientvisits.isDeleted, 0),
          eq(patients.hcenterId, this.tdb.tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Visit ${visitId} not found`);
    return row;
  }
}

function computeBmi(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const hM = heightCm / 100;
  return Math.round((weightKg / (hM * hM)) * 10) / 10;
}

function fmtDate(v: Date): string {
  const y=v.getUTCFullYear(),mo=String(v.getUTCMonth()+1).padStart(2,"0"),d=String(v.getUTCDate()).padStart(2,"0");
  const h=String(v.getUTCHours()).padStart(2,"0"),mi=String(v.getUTCMinutes()).padStart(2,"0"),s=String(v.getUTCSeconds()).padStart(2,"0"),ms=String(v.getUTCMilliseconds()).padStart(3,"0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
