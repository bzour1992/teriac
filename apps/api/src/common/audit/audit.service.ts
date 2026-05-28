import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { sql } from "drizzle-orm";
import { auditLog } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { TenantContextService } from "../tenant/tenant-context";

export type AuditAction =
  | "View"
  | "Create"
  | "Update"
  | "Delete"
  | "Export"
  | "Print"
  | "Login"
  | "LoginFailed"
  | "Logout";

export type AuditOutcome = "success" | "denied" | "error";

export interface AuditRecordInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  patientContext?: string | null;
  changedFields?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  outcome?: AuditOutcome;
  errorMessage?: string;
  /** Override the user/HCenter if writing audit for an unauthenticated event (e.g. failed login). */
  userIdOverride?: string;
  hcenterIdOverride?: string;
  ipAddressOverride?: string;
}

/**
 * Writes one row to `audit_log` per call. Append-only.
 *
 * Called by:
 *   - AuthService on login success/failure/logout
 *   - Every PHI-touching service via an interceptor (added when first PHI module lands)
 *
 * Failures here are logged but never propagated — we don't want a broken audit
 * write to drop a successful clinical action. We do, however, alert on it via
 * the structured logger so ops can act.
 */
@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tenant: TenantContextService,
    private readonly cls: ClsService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    // TEMP: PHI read events ("View") are noisy and disabled while we tune
    // retention + storage. Remove this short-circuit to resume logging reads
    // (HIPAA "access" requirement). Writes (Create/Update/Delete/Export/Print)
    // and auth events still flow through.
    if (input.action === "View") return;

    const ctx = this.tenant.tryGet();
    const userId = input.userIdOverride ?? ctx?.userId;
    const hcenterId = input.hcenterIdOverride ?? ctx?.hcenterId;
    const correlationId = this.cls.getId() ?? crypto.randomUUID();

    if (!userId || !hcenterId) {
      this.log.warn(
        `audit.record skipped — missing userId or hcenterId (action=${input.action} entity=${input.entityType})`,
      );
      return;
    }

    try {
      await this.db.insert(auditLog).values({
        eventTime: sql`current_timestamp(6)`,
        userId,
        hcenterId,
        ipAddress: input.ipAddressOverride ?? "",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        patientContext: input.patientContext ?? null,
        changedFields:
          input.changedFields && input.changedFields.length > 0
            ? JSON.stringify(input.changedFields)
            : null,
        previousValues:
          input.previousValues !== undefined ? JSON.stringify(input.previousValues) : null,
        newValues: input.newValues !== undefined ? JSON.stringify(input.newValues) : null,
        correlationId,
        outcome: input.outcome ?? "success",
        errorMessage: input.errorMessage ?? null,
      });
    } catch (err) {
      this.log.error(
        `audit_log insert failed (action=${input.action} entity=${input.entityType}): ${(err as Error).message}`,
      );
    }
  }
}
