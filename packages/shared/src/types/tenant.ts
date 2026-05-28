import type { Language, ModuleKey, UserType } from "../enums/index";

export interface TenantContext {
  hcenterId: string;
  userId: string;
  userType: UserType;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  language: Language;
  permissions: ReadonlySet<string>;
}

export interface AuthenticatedUser {
  userId: string;
  hcenterId: string;
  userName: string;
  firstName?: string | null;
  lastName?: string | null;
  userType: UserType;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  language: Language;
}

export interface ModuleToggle {
  hcenterId: string;
  moduleKey: ModuleKey;
  isEnabled: boolean;
  enabledAt?: string | null;
  enabledBy?: string | null;
  notes?: string | null;
}

/** Audit log payload — append-only, written for every PHI read/write. */
export interface AuditLogEntry {
  eventTime: string;
  userId: string;
  hcenterId: string;
  ipAddress: string;
  action: "View" | "Create" | "Update" | "Delete" | "Export" | "Print";
  entityType: string;
  entityId: string;
  patientContext?: string | null;
  changedFields?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  correlationId: string;
}
