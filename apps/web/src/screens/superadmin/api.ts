import { api } from "../../lib/api/client";
import type {
  HCenterSettings,
  AdminUserItem,
  CreateUserPayload,
} from "../admin/api";

// ── Stats ────────────────────────────────────────────────────────────────────

export interface SuperadminStats {
  clinicCount: number;
  activeClinicCount: number;
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  totalVisits: number;
  totalInvoicedThisMonth: number;
  clinicsByPatientCount: Array<{
    clinicId: string;
    clinicName: string;
    patientCount: number;
  }>;
}

export function getSuperadminStats(signal?: AbortSignal): Promise<SuperadminStats> {
  return api<SuperadminStats>("/superadmin/stats", { signal });
}

// ── Clinics ──────────────────────────────────────────────────────────────────

export interface ClinicListItem {
  hcenterId: string;
  name: string;
  nameRep: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  subscriptionType: number;
  isOneDoctor: boolean;
  countryId: string | null;
  cityId: string | null;
  supportStartDate: string;
  lastRenewalDate: string | null;
  userCount: number;
  patientCount: number;
  specialtyCount: number;
}

export interface ClinicDetail extends ClinicListItem {
  reportAddress: string | null;
  reportsWorkingTimes: string | null;
  clinicManager: string | null;
  clinicManagerEmail: string | null;
  clinicManagerMob: string | null;
  hcenterInitials: string | null;
  eClaimLinkId: string | null;
}

export interface ClinicListResponse {
  data: ClinicListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateClinicPayload {
  name: string;
  nameRep?: string | null;
  email?: string | null;
  phone?: string | null;
  hcenterInitials?: string | null;
  isOneDoctor?: boolean;
  countryId?: string | null;
  cityId?: string | null;
  subscriptionType?: number;
}

export interface UpdateClinicPayload {
  name?: string;
  nameRep?: string | null;
  email?: string | null;
  phone?: string | null;
  hcenterInitials?: string | null;
  isOneDoctor?: boolean;
  countryId?: string | null;
  cityId?: string | null;
  reportAddress?: string | null;
  reportsWorkingTimes?: string | null;
  clinicManager?: string | null;
  clinicManagerEmail?: string | null;
  clinicManagerMob?: string | null;
  eClaimLinkId?: string | null;
  subscriptionType?: number;
}

export interface ListClinicsParams {
  q?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function listClinics(
  params: ListClinicsParams,
  signal?: AbortSignal,
): Promise<ClinicListResponse> {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  };
  if (params.q && params.q.trim().length > 0) query.q = params.q.trim();
  if (params.active !== undefined) query.active = params.active;
  return api<ClinicListResponse>("/superadmin/clinics", { query, signal });
}

export function getClinic(id: string, signal?: AbortSignal): Promise<ClinicDetail> {
  return api<ClinicDetail>(`/superadmin/clinics/${id}`, { signal });
}

export function createClinic(payload: CreateClinicPayload): Promise<{ hcenterId: string }> {
  return api<{ hcenterId: string }>("/superadmin/clinics", {
    method: "POST",
    body: payload,
  });
}

export function updateClinic(id: string, payload: UpdateClinicPayload): Promise<void> {
  return api<void>(`/superadmin/clinics/${id}`, { method: "PUT", body: payload });
}

export function setClinicActive(id: string, isActive: boolean): Promise<void> {
  return api<void>(`/superadmin/clinics/${id}/activate`, {
    method: "PATCH",
    body: { isActive },
  });
}

// ── Clinic settings ──────────────────────────────────────────────────────────

export function getClinicSettings(
  id: string,
  signal?: AbortSignal,
): Promise<HCenterSettings> {
  return api<HCenterSettings>(`/superadmin/clinics/${id}/settings`, { signal });
}

export function updateClinicSettings(
  id: string,
  payload: Partial<HCenterSettings>,
): Promise<void> {
  return api<void>(`/superadmin/clinics/${id}/settings`, {
    method: "PUT",
    body: payload,
  });
}

// ── Clinic users (cross-tenant) ──────────────────────────────────────────────

export function listClinicUsers(
  id: string,
  signal?: AbortSignal,
): Promise<AdminUserItem[]> {
  return api<AdminUserItem[]>(`/superadmin/clinics/${id}/users`, { signal });
}

export function createClinicUser(
  id: string,
  payload: CreateUserPayload,
): Promise<{ userId: string }> {
  return api<{ userId: string }>(`/superadmin/clinics/${id}/users`, {
    method: "POST",
    body: payload,
  });
}

// ── Clinic specialties ───────────────────────────────────────────────────────

export interface ClinicSpecialty {
  hcenterSpecialityId: string;
  specialityId: string;
  specialityName: string;
  defaultPayment: number | null;
  showOnProfile: boolean;
}

export interface AddClinicSpecialtyPayload {
  specialityId: string;
  defaultPayment?: number | null;
  showOnProfile?: boolean;
}

export function listClinicSpecialties(
  id: string,
  signal?: AbortSignal,
): Promise<ClinicSpecialty[]> {
  return api<ClinicSpecialty[]>(`/superadmin/clinics/${id}/specialties`, { signal });
}

export function addClinicSpecialty(
  id: string,
  payload: AddClinicSpecialtyPayload,
): Promise<{ hcenterSpecialityId: string }> {
  return api<{ hcenterSpecialityId: string }>(
    `/superadmin/clinics/${id}/specialties`,
    { method: "POST", body: payload },
  );
}

export function removeClinicSpecialty(
  clinicId: string,
  specialtyId: string,
): Promise<void> {
  return api<void>(`/superadmin/clinics/${clinicId}/specialties/${specialtyId}`, {
    method: "DELETE",
  });
}

// ── Master specialties ───────────────────────────────────────────────────────

export interface MasterSpecialty {
  specialityId: string;
  specialityName: string;
  description: string | null;
  specialtyGroup: string;
}

export interface CreateMasterSpecialtyPayload {
  specialityName: string;
  description?: string | null;
  specialtyGroup: string;
}

export function listMasterSpecialties(
  signal?: AbortSignal,
): Promise<MasterSpecialty[]> {
  return api<MasterSpecialty[]>("/superadmin/specialties", { signal });
}

export function createMasterSpecialty(
  payload: CreateMasterSpecialtyPayload,
): Promise<{ specialityId: string }> {
  return api<{ specialityId: string }>("/superadmin/specialties", {
    method: "POST",
    body: payload,
  });
}

export function updateMasterSpecialty(
  id: string,
  payload: Partial<MasterSpecialty>,
): Promise<void> {
  return api<void>(`/superadmin/specialties/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

// ── Modules ──────────────────────────────────────────────────────────────────

export interface ClinicModule {
  moduleKey: string;
  isEnabled: boolean;
  enabledAt: string | null;
  notes: string | null;
}

export interface UpdateClinicModulePayload {
  isEnabled: boolean;
  notes?: string | null;
}

export function listClinicModules(
  id: string,
  signal?: AbortSignal,
): Promise<ClinicModule[]> {
  return api<ClinicModule[]>(`/superadmin/clinics/${id}/modules`, { signal });
}

export function updateClinicModule(
  clinicId: string,
  moduleKey: string,
  payload: UpdateClinicModulePayload,
): Promise<void> {
  return api<void>(`/superadmin/clinics/${clinicId}/modules/${moduleKey}`, {
    method: "PUT",
    body: payload,
  });
}

export const KNOWN_MODULE_KEYS: readonly string[] = [
  "pediatrics",
  "obgyn",
  "fertility",
  "dermatology",
  "dentistry",
  "cardiology",
  "optometry",
  "finance",
  "reports",
  "audit",
];

export const MODULE_LABELS: Record<string, string> = {
  pediatrics: "Pediatrics",
  obgyn: "OB/GYN",
  fertility: "Fertility",
  dermatology: "Dermatology",
  dentistry: "Dentistry",
  cardiology: "Cardiology",
  optometry: "Optometry",
  finance: "Finance",
  reports: "Reports",
  audit: "Audit log",
};

// ── Field rules ──────────────────────────────────────────────────────────────

export type FieldVisibility = "hidden" | "visible" | "readonly";
export type FieldRequirement = "optional" | "required" | "conditional";

export interface FieldRule {
  entityName: string;
  fieldName: string;
  visibility: FieldVisibility;
  requirement: FieldRequirement;
  defaultValue: string | null;
  labelEn: string | null;
  labelAr: string | null;
}

export function listClinicFieldRules(
  id: string,
  entity?: string,
  signal?: AbortSignal,
): Promise<FieldRule[]> {
  const query: Record<string, string | undefined> = {};
  if (entity) query.entity = entity;
  return api<FieldRule[]>(`/superadmin/clinics/${id}/field-rules`, {
    query,
    signal,
  });
}

export function updateClinicFieldRule(
  clinicId: string,
  entity: string,
  field: string,
  payload: Partial<FieldRule>,
): Promise<void> {
  return api<void>(
    `/superadmin/clinics/${clinicId}/field-rules/${entity}/${field}`,
    { method: "PUT", body: payload },
  );
}

export const FIELD_RULE_ENTITIES: readonly string[] = [
  "patient",
  "patient_card",
  "visit",
  "visit_card",
  "appointment",
  "invoice",
  "prescription",
  // Patient sub-records
  "allergy",
  "chronic_disease",
  "family_history",
  "insurance",
  "long_term_medication",
  "substance_use",
  // Visit sub-records
  "diagnosis",
];

/** Entities whose rows represent cards/sections (visibility-only). */
export function isCardEntity(entity: string): boolean {
  return entity.endsWith("_card");
}

export const COMMON_FIELDS_BY_ENTITY: Record<string, string[]> = {
  patient: [
    // Identifiers
    "nationalId",
    "sex",
    "dateOfBirth",
    "passportNumber",
    // English name
    "prefix",
    "firstName",
    "secondName",
    "thirdName",
    "lastName",
    // Arabic name
    "firstNameAr",
    "secondNameAr",
    "thirdNameAr",
    "lastNameAr",
    // Demographics
    "religion",
    "nationality",
    "maritalStatusId",
    // Contact
    "mobileNumber",
    "email",
    "address",
    // Vitals baseline
    "height",
    "weight",
    // Emergency contact
    "contactPersonName",
    "contactRelation",
    "contactPhoneNumber",
  ],
  visit: [
    // Classification
    "visitType",
    "visitDate",
    "intensity",
    "painLevel",
    "outcome",
    "isHospitalCase",
    "hospitalName",
    // SOAP / clinical narrative
    "chiefComplaint",
    "historyOfPresentIllness",
    "pastMedicalHistory",
    "notes",
    "recommendations",
    "disposition",
    // Referral
    "sourceOfReferral",
    "transferTo",
    "destinationOfReferral",
  ],
  // Whole-card visibility on the patient screens — one row per section
  // (Allergies, Problems, Notes, etc.). Only `visibility` and label overrides
  // matter; the `requirement` and `defaultValue` columns are hidden in the
  // editor for *_card entities.
  patient_card: [
    "summary",
    "last_activity",
    "recent_visits",
    "allergies",
    "problems",
    "chronic_diseases",
    "long_term_medications",
    "family_history",
    "immunizations",
    "lab_requests",
    "notes",
    "contact",
    "personal_info",
    "emergency_contact",
    "insurance",
    "billing",
    "substance_use",
    "echo",
    "vitals_trends",
  ],
  // Whole-card visibility on the visit detail screen — one row per section.
  visit_card: [
    "vitals",
    "subjective",
    "assessment",
    "plan",
    "soap_notes",
    "pmh",
    "recommendations",
    "visit_metadata",
    "revisits",
    "body_system_review",
    "physical_exam",
    "billing",
  ],
  appointment: [
    // System-anchored (rename via labels but can't be hidden)
    "doctorId",
    "scheduledInDate",
    "durationMin",
    // Patient block (mutually exclusive — `notForPatient` toggle)
    "notForPatient",
    "patientId",
    "blockerLabel",
    // Status / classification
    "statusId",
    "isSurgery",
    // Details
    "location",
    "notes",
    "contactPhone",
    "contactEmail",
  ],
  invoice: ["invoiceNumber", "discount", "coveredByHealthInsurance"],
  prescription: [
    "medicineId",
    "indication",
    "dose",
    "route",
    "frequency",
    "frequencyUnit",
    "period",
    "quantityNumber",
    "quantityForm",
    "notes",
  ],
  allergy: ["medicalConditionId", "severity", "lastOccurenceDate", "reaction", "treatment"],
  chronic_disease: ["medicalConditionId", "yearDiagnosed", "monthDiagnosed", "notes"],
  family_history: ["medicalConditionId", "description"],
  insurance: [
    "insuranceCompany",
    "insuranceLevel",
    "coveragePercentage",
    "insuranceCardNumber",
    "participantName",
    "participantCompany",
    "relationToParticipant",
    "notes",
  ],
  long_term_medication: [
    "medicineId",
    "indication",
    "dose",
    "route",
    "frequency",
    "frequencyUnit",
    "period",
    "quantityNumber",
    "quantityForm",
    "prescribedBy",
    "prescriptionDate",
    "notes",
  ],
  substance_use: [
    "cigarettesNumber",
    "sheeshaHeadNumber",
    "totalPackYear",
    "smokingComments",
    "beerNumber",
    "wineNumber",
    "drinkingComments",
    "drugComments",
  ],
  diagnosis: ["medicalConditionId", "dateDiagnosed", "ageOfOnset", "comments"],
};

// ── Cross-tenant users ───────────────────────────────────────────────────────

export interface CrossClinicUser {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  hcenterId: string;
  clinicName: string;
}

export interface CrossClinicUsersResponse {
  data: CrossClinicUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListCrossUsersParams {
  q?: string;
  clinicId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function listCrossClinicUsers(
  params: ListCrossUsersParams,
  signal?: AbortSignal,
): Promise<CrossClinicUsersResponse> {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  };
  if (params.q && params.q.trim().length > 0) query.q = params.q.trim();
  if (params.clinicId) query.clinicId = params.clinicId;
  if (params.active !== undefined) query.active = params.active;
  return api<CrossClinicUsersResponse>("/superadmin/users", { query, signal });
}

// ── Per-clinic audit summary + purge (superadmin) ────────────────────────────

export interface ClinicAuditSummary {
  clinicId: string;
  total: number;
  failed: number;
  oldestEvent: string | null;
  newestEvent: string | null;
  last30Days: number;
  last60Days: number;
  last90Days: number;
  byAction: Array<{ action: string; count: number }>;
}

export function getClinicAuditSummary(
  clinicId: string,
  signal?: AbortSignal,
): Promise<ClinicAuditSummary> {
  return api(`/superadmin/clinics/${clinicId}/audit-summary`, { signal });
}

export function purgeClinicAuditLog(
  clinicId: string,
  olderThanMonths: 1 | 2 | 3,
): Promise<{ deleted: number; cutoff: string }> {
  return api(`/superadmin/clinics/${clinicId}/audit-log`, {
    method: "DELETE",
    query: { olderThanMonths },
  });
}

// ── Constants ────────────────────────────────────────────────────────────────

export const SUBSCRIPTION_LABEL: Record<number, string> = {
  1: "Trial",
  2: "Basic",
  3: "Standard",
  4: "Premium",
  5: "Enterprise",
};
