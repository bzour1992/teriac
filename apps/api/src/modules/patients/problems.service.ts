import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { patientproblems, patients } from "../../db/schema";
import { TenantDbService } from "../../db/tenant-db.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateProblemDto, ProblemListItem, UpdateProblemDto } from "./dto/problem.dto";

@Injectable()
export class ProblemsService {
  constructor(
    private readonly tdb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<ProblemListItem[]> {
    await this.assertPatientInTenant(patientId);

    const rows = await this.tdb.db
      .select()
      .from(patientproblems)
      .where(eq(patientproblems.patientId, patientId))
      .orderBy(desc(patientproblems.isActive), patientproblems.problemCategory);

    return rows.map((r) => ({
      patientProblemId: r.patientProblemId,
      problemText: r.problemText,
      problemCategory: r.problemCategory,
      onsetDate: r.onsetDate ?? null,
      lastOccurenceDate: r.lastOccurenceDate ?? null,
      isActive: r.isActive === 1,
    }));
  }

  async create(patientId: string, dto: CreateProblemDto): Promise<{ patientProblemId: string }> {
    await this.assertPatientInTenant(patientId);

    const id = randomUUID();
    await this.tdb.db.insert(patientproblems).values({
      patientProblemId: id,
      patientId,
      problemText: dto.problemText,
      problemCategory: dto.problemCategory ?? 1,
      onsetDate: normalizeDate(dto.onsetDate),
      lastOccurenceDate: normalizeDate(dto.lastOccurenceDate),
      isActive: dto.isActive !== false ? 1 : 0,
      isUserModified: 1,
    });

    await this.audit.record({
      action: "Create",
      entityType: "PatientProblem",
      entityId: id,
      patientContext: patientId,
      newValues: { problemText: dto.problemText, problemCategory: dto.problemCategory ?? 1 },
    });

    return { patientProblemId: id };
  }

  async update(patientId: string, problemId: string, dto: UpdateProblemDto): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select()
      .from(patientproblems)
      .where(
        and(
          eq(patientproblems.patientProblemId, problemId),
          eq(patientproblems.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Problem ${problemId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFields: Record<string, any> = { isUserModified: 1 };
    const prev: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};

    if (dto.problemText !== undefined && dto.problemText !== current.problemText) {
      setFields.problemText = dto.problemText;
      prev.problemText = current.problemText;
      next.problemText = dto.problemText;
    }
    if (dto.problemCategory !== undefined && dto.problemCategory !== current.problemCategory) {
      setFields.problemCategory = dto.problemCategory;
      prev.problemCategory = current.problemCategory;
      next.problemCategory = dto.problemCategory;
    }
    if (dto.isActive !== undefined) {
      const nextActive = dto.isActive ? 1 : 0;
      if (nextActive !== current.isActive) {
        setFields.isActive = nextActive;
        prev.isActive = current.isActive === 1;
        next.isActive = dto.isActive;
      }
    }
    if (dto.onsetDate !== undefined) {
      setFields.onsetDate = normalizeDate(dto.onsetDate);
    }
    if (dto.lastOccurenceDate !== undefined) {
      setFields.lastOccurenceDate = normalizeDate(dto.lastOccurenceDate);
    }

    if (Object.keys(setFields).length <= 1) return; // only isUserModified

    const result = await this.tdb.db
      .update(patientproblems)
      .set(setFields)
      .where(eq(patientproblems.patientProblemId, problemId));

    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    if (affected !== null && affected !== 1) {
      throw new ConflictException(`Expected to update 1 problem, affected ${affected}`);
    }

    await this.audit.record({
      action: "Update",
      entityType: "PatientProblem",
      entityId: problemId,
      patientContext: patientId,
      changedFields: Object.keys(next),
      previousValues: prev,
      newValues: next,
    });
  }

  async delete(patientId: string, problemId: string): Promise<void> {
    await this.assertPatientInTenant(patientId);

    const [current] = await this.tdb.db
      .select()
      .from(patientproblems)
      .where(
        and(
          eq(patientproblems.patientProblemId, problemId),
          eq(patientproblems.patientId, patientId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException(`Problem ${problemId} not found`);

    await this.tdb.db
      .delete(patientproblems)
      .where(eq(patientproblems.patientProblemId, problemId));

    await this.audit.record({
      action: "Delete",
      entityType: "PatientProblem",
      entityId: problemId,
      patientContext: patientId,
      previousValues: { problemText: current.problemText, problemCategory: current.problemCategory },
    });
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
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);
  }
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}
