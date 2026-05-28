import { api } from "../../lib/api/client";

// ── HCenter profile ──────────────────────────────────────────────────────────

export interface HCenterProfile {
  hcenterId: string;
  name: string;
  nameRep: string | null;
  email: string | null;
  phone: string | null;
  reportAddress: string | null;
  reportsWorkingTimes: string | null;
  clinicManager: string | null;
  clinicManagerEmail: string | null;
  clinicManagerMob: string | null;
  hcenterInitials: string | null;
  preferredCurrency: string | null;
  isOneDoctor: boolean;
  subscriptionType: number;
}

export interface UpdateHCenterPayload {
  name?: string;
  nameRep?: string | null;
  email?: string | null;
  phone?: string | null;
  reportAddress?: string | null;
  reportsWorkingTimes?: string | null;
  clinicManager?: string | null;
  clinicManagerEmail?: string | null;
  clinicManagerMob?: string | null;
  hcenterInitials?: string | null;
  preferredCurrency?: string | null;
}

export function getHCenter(signal?: AbortSignal): Promise<HCenterProfile> {
  return api<HCenterProfile>("/admin/hcenter", { signal });
}

export function updateHCenter(payload: UpdateHCenterPayload): Promise<void> {
  return api<void>("/admin/hcenter", { method: "PUT", body: payload });
}

// ── System settings ───────────────────────────────────────────────────────────

export interface HCenterSettings {
  defaultPayment: number;
  preferredCurrency: string | null;
  isHeightWeightRequired: boolean;
  areAllergiesRequired: boolean;
  areChronicDiseasesRequired: boolean;
  isPatientArabicNameRequired: boolean;
  canDoctorsEditPatientDemographicInformation: boolean;
  onlyVisitDoctorCanEditVisitRecords: boolean;
  preventEditingPatientVisitWhenStatusIsResolvedOrFailed: boolean;
  onlyCenterAdminIsAllowedToDeleteAttachments: boolean;
  numberOfOperationRooms: number;
}

export function getSettings(signal?: AbortSignal): Promise<HCenterSettings> {
  return api<HCenterSettings>("/admin/settings", { signal });
}

export function updateSettings(payload: Partial<HCenterSettings>): Promise<void> {
  return api<void>("/admin/settings", { method: "PUT", body: payload });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUserItem {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  position: string | null;
  isAdmin: boolean;
  isFinancialAdmin: boolean;
  isActive: boolean;
  specialityName: string | null;
}

export interface CreateUserPayload {
  userName: string;
  password: string;
  firstName: string;
  lastName: string;
  secondName?: string | null;
  userType: number;
  position?: string | null;
  isAdmin?: boolean;
  isFinancialAdmin?: boolean;
  hcenterSpecialityId?: string | null;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  secondName?: string | null;
  userType?: number;
  position?: string | null;
  isAdmin?: boolean;
  isFinancialAdmin?: boolean;
  isActive?: boolean;
  password?: string | null;
  hcenterSpecialityId?: string | null;
}

export function listAdminUsers(signal?: AbortSignal): Promise<AdminUserItem[]> {
  return api<AdminUserItem[]>("/admin/users", { signal });
}

export function createUser(payload: CreateUserPayload): Promise<{ userId: string }> {
  return api<{ userId: string }>("/admin/users", { method: "POST", body: payload });
}

export function updateUser(userId: string, payload: UpdateUserPayload): Promise<void> {
  return api<void>(`/admin/users/${userId}`, { method: "PUT", body: payload });
}

// ── Permissions ───────────────────────────────────────────────────────────────

export interface PermissionItem {
  permissionId: number;
  permissionName: string;
  permissionType: number;
}

export function listPermissions(signal?: AbortSignal): Promise<PermissionItem[]> {
  return api<PermissionItem[]>("/admin/permissions", { signal });
}

export function getUserPermissions(userId: string, signal?: AbortSignal): Promise<number[]> {
  return api<number[]>(`/admin/users/${userId}/permissions`, { signal });
}

export function setUserPermissions(
  userId: string,
  permissionIds: number[],
): Promise<void> {
  return api<void>(`/admin/users/${userId}/permissions`, {
    method: "PUT",
    body: { permissionIds },
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const USER_TYPE_LABEL: Record<number, string> = {
  1: "Doctor",
  2: "Nurse",
  3: "Receptionist",
  4: "Admin",
  5: "Lab Tech",
  6: "Optometrist",
};

export const PERMISSION_TYPE_LABEL: Record<number, string> = {
  1: "Module",
  2: "Feature",
  3: "Report",
  4: "Action",
};

export const PAYMENT_OPTIONS = [
  { v: 1, label: "Cash" },
  { v: 2, label: "Card" },
  { v: 3, label: "Insurance" },
] as const;
