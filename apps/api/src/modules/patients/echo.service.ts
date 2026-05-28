import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { patientechocardiogramtests, patients } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateEchoDto, EchoListItem, UpdateEchoDto } from "./dto/echo.dto";

@Injectable()
export class EchoService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<EchoListItem[]> {
    await this.assertPatient(patientId);
    const rows = await this.tdb.db
      .select()
      .from(patientechocardiogramtests)
      .where(eq(patientechocardiogramtests.patientId, patientId))
      .orderBy(desc(patientechocardiogramtests.testDate));
    return rows.map(mapEcho);
  }

  async create(patientId: string, dto: CreateEchoDto): Promise<{ patientEchoCardiogramTestId: string }> {
    await this.assertPatient(patientId);
    const id = randomUUID();
    await this.tdb.db.insert(patientechocardiogramtests).values({
      patientEchoCardiogramTestId: id,
      patientId,
      testDate: dto.testDate,
      patientVisitId: dto.patientVisitId ?? null,
      requestedBy: dto.requestedBy?.trim() || null,
      ppd: dto.ppd?.trim() || null,
      lvedd: dto.lvedd ?? null, lvesd: dto.lvesd ?? null,
      ivs: dto.ivs ?? null, plvw: dto.plvw ?? null,
      aorticRoot: dto.aorticRoot ?? null, la: dto.la ?? null, rv: dto.rv ?? null,
      dmModeFindings: dto.dmModeFindings?.trim() || null,
      dopplerFindings: dto.dopplerFindings?.trim() || null,
      conclusion: dto.conclusion?.trim() || null,
    });
    await this.audit.record({
      action: "Create", entityType: "EchoCardiogram", entityId: id,
      patientContext: patientId, newValues: { testDate: dto.testDate },
    });
    return { patientEchoCardiogramTestId: id };
  }

  async update(patientId: string, echoId: string, dto: UpdateEchoDto): Promise<void> {
    await this.assertPatient(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientechocardiogramtests)
      .where(and(
        eq(patientechocardiogramtests.patientEchoCardiogramTestId, echoId),
        eq(patientechocardiogramtests.patientId, patientId),
      ))
      .limit(1);
    if (!current) throw new NotFoundException(`Echo ${echoId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = {};
    if (dto.testDate !== undefined) setFields.testDate = dto.testDate;
    if (dto.requestedBy !== undefined) setFields.requestedBy = dto.requestedBy?.trim() || null;
    if (dto.ppd !== undefined) setFields.ppd = dto.ppd?.trim() || null;
    for (const f of ["lvedd", "lvesd", "ivs", "plvw", "aorticRoot", "la", "rv"] as const) {
      if (dto[f] !== undefined) setFields[f] = dto[f];
    }
    if (dto.dmModeFindings !== undefined) setFields.dmModeFindings = dto.dmModeFindings?.trim() || null;
    if (dto.dopplerFindings !== undefined) setFields.dopplerFindings = dto.dopplerFindings?.trim() || null;
    if (dto.conclusion !== undefined) setFields.conclusion = dto.conclusion?.trim() || null;

    if (Object.keys(setFields).length === 0) return;
    await this.tdb.db
      .update(patientechocardiogramtests)
      .set(setFields)
      .where(eq(patientechocardiogramtests.patientEchoCardiogramTestId, echoId));
    await this.audit.record({
      action: "Update", entityType: "EchoCardiogram", entityId: echoId,
      patientContext: patientId, newValues: setFields,
    });
  }

  async delete(patientId: string, echoId: string): Promise<void> {
    await this.assertPatient(patientId);
    const [current] = await this.tdb.db
      .select()
      .from(patientechocardiogramtests)
      .where(and(
        eq(patientechocardiogramtests.patientEchoCardiogramTestId, echoId),
        eq(patientechocardiogramtests.patientId, patientId),
      ))
      .limit(1);
    if (!current) throw new NotFoundException(`Echo ${echoId} not found`);
    await this.tdb.db.delete(patientechocardiogramtests)
      .where(eq(patientechocardiogramtests.patientEchoCardiogramTestId, echoId));
    await this.audit.record({
      action: "Delete", entityType: "EchoCardiogram", entityId: echoId,
      patientContext: patientId, previousValues: { testDate: current.testDate },
    });
  }

  private async assertPatient(patientId: string): Promise<void> {
    const [row] = await this.tdb.db
      .select({ id: patients.patientId })
      .from(patients)
      .where(and(
        eq(patients.patientId, patientId),
        eq(patients.isDeleted, 0),
        eq(patients.hcenterId, this.tdb.tenantId),
      ))
      .limit(1);
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);
  }
}

function mapEcho(r: typeof patientechocardiogramtests.$inferSelect): EchoListItem {
  return {
    patientEchoCardiogramTestId: r.patientEchoCardiogramTestId,
    testDate: r.testDate,
    patientVisitId: r.patientVisitId ?? null,
    requestedBy: r.requestedBy ?? null,
    ppd: r.ppd ?? null,
    lvedd: r.lvedd ?? null, lvesd: r.lvesd ?? null,
    ivs: r.ivs ?? null, plvw: r.plvw ?? null,
    aorticRoot: r.aorticRoot ?? null, la: r.la ?? null, rv: r.rv ?? null,
    dmModeFindings: r.dmModeFindings ?? null,
    dopplerFindings: r.dopplerFindings ?? null,
    conclusion: r.conclusion ?? null,
  };
}
