import { api } from "../../lib/api/client";
import { authStore } from "../../lib/auth/store";

export interface AuditEvent {
  auditId: number;
  eventTime: string;
  user: { userId: string; userName: string | null; fullName: string | null };
  ipAddress: string;
  userAgent: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  patient: { patientId: string; fullName: string | null } | null;
  outcome: string;
  errorMessage: string | null;
  correlationId: string;
}

export interface AuditEventDetail extends AuditEvent {
  changedFields: string[] | null;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface AuditListResponse {
  data: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    actions: FacetBucket[];
    entityTypes: FacetBucket[];
    users: FacetBucket[];
    outcomes: FacetBucket[];
  };
}

export interface AuditSummary {
  days: string[];
  byDay: Array<{ date: string; total: number; failed: number }>;
  totals: { total: number; failed: number };
  topAction: { action: string; count: number } | null;
  topUser: { userId: string; userName: string | null; fullName: string | null; count: number } | null;
}

export interface ListAuditParams {
  from?: string;
  to?: string;
  /** CSV — e.g. "Create,Update". */
  action?: string;
  /** CSV — e.g. "Patient,Visit". */
  entityType?: string;
  userId?: string;
  patientId?: string;
  outcome?: string;
  correlationId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

function toQuery(p: ListAuditParams): Record<string, string | number | undefined> {
  return {
    from: p.from,
    to: p.to,
    action: p.action,
    entityType: p.entityType,
    userId: p.userId,
    patientId: p.patientId,
    outcome: p.outcome,
    correlationId: p.correlationId,
    q: p.q,
    page: p.page,
    pageSize: p.pageSize,
  };
}

export function listAudit(
  params: ListAuditParams,
  signal?: AbortSignal,
): Promise<AuditListResponse> {
  return api("/audit", { query: toQuery(params), signal });
}

export function getAuditEvent(id: number, signal?: AbortSignal): Promise<AuditEventDetail> {
  return api(`/audit/${id}`, { signal });
}

export function getAuditSummary(
  from?: string,
  to?: string,
  signal?: AbortSignal,
): Promise<AuditSummary> {
  return api("/audit/summary", { query: { from, to }, signal });
}

/**
 * Build the CSV-export URL. Browsers can't easily download arbitrary blobs
 * across a fetch with auth headers, so we use a tokenised URL with the bearer
 * appended as ?access_token=... — actually no, the API doesn't support that.
 * Instead, fetch as a blob and trigger a download client-side.
 */
export async function exportAuditCsv(params: ListAuditParams): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const base =
    (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1") + "/audit/export";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(toQuery(params))) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${base}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}
