import { api } from "../../lib/api/client";

// ---- Allergies ----

export type AllergySeverity = 1 | 2 | 3 | 4;

export interface AllergyListItem {
  allergyId: string;
  medicalConditionId: string;
  conditionName: string;
  severity: number | null;
  lastOccurenceDate: string | null;
  reaction: string | null;
  treatment: string | null;
}

export interface CreateAllergyPayload {
  medicalConditionId: string;
  severity?: AllergySeverity | null;
  lastOccurenceDate?: string | null;
  reaction?: string | null;
  treatment?: string | null;
}

export type UpdateAllergyPayload = Partial<CreateAllergyPayload>;

export function listAllergies(
  patientId: string,
  signal?: AbortSignal,
): Promise<AllergyListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/allergies`, { signal });
}

export function createAllergy(
  patientId: string,
  payload: CreateAllergyPayload,
): Promise<{ allergyId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/allergies`, {
    method: "POST",
    body: payload,
  });
}

export function updateAllergy(
  patientId: string,
  allergyId: string,
  payload: UpdateAllergyPayload,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/allergies/${encodeURIComponent(allergyId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteAllergy(patientId: string, allergyId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/allergies/${encodeURIComponent(allergyId)}`,
    { method: "DELETE" },
  );
}

// ---- Chronic diseases ----

export interface ChronicDiseaseListItem {
  chronicDiseaseId: string;
  medicalConditionId: string;
  conditionName: string;
  yearDiagnosed: number | null;
  monthDiagnosed: number | null;
  notes: string | null;
}

export interface CreateChronicDiseasePayload {
  medicalConditionId: string;
  yearDiagnosed?: number | null;
  monthDiagnosed?: number | null;
  notes?: string | null;
}

export type UpdateChronicDiseasePayload = Partial<CreateChronicDiseasePayload>;

export function listChronicDiseases(
  patientId: string,
  signal?: AbortSignal,
): Promise<ChronicDiseaseListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/chronic-diseases`, { signal });
}

export function createChronicDisease(
  patientId: string,
  payload: CreateChronicDiseasePayload,
): Promise<{ chronicDiseaseId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/chronic-diseases`, {
    method: "POST",
    body: payload,
  });
}

export function updateChronicDisease(
  patientId: string,
  chronicId: string,
  payload: UpdateChronicDiseasePayload,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/chronic-diseases/${encodeURIComponent(chronicId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteChronicDisease(patientId: string, chronicId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/chronic-diseases/${encodeURIComponent(chronicId)}`,
    { method: "DELETE" },
  );
}

// ---- Display helpers ----

export const SEVERITY_LABEL: Record<number, string> = {
  1: "Mild",
  2: "Moderate",
  3: "Severe",
  4: "Anaphylactic",
};

export const MONTH_LABEL = [
  "—",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ---- Long-term medications ----

export interface LongTermMedicationListItem {
  patientLongTermMedicineId: string;
  medicineId: string;
  medicineName: string;
  scientificName: string | null;
  indication: string | null;
  dose: string | null;
  period: string | null;
  frequency: number | null;
  frequencyUnit: string | null;
  quantityNumber: string | null;
  quantityForm: string | null;
  route: string | null;
  prescribedBy: string | null;
  prescriptionDate: string | null;
  notes: string | null;
}

export interface CreateLongTermMedicationPayload {
  medicineId: string;
  indication?: string | null;
  dose?: string | null;
  period?: string | null;
  frequency?: number | null;
  frequencyUnit?: string | null;
  quantityNumber?: string | null;
  quantityForm?: string | null;
  route?: string | null;
  prescribedBy?: string | null;
  prescriptionDate?: string | null;
  notes?: string | null;
}

export type UpdateLongTermMedicationPayload = Partial<CreateLongTermMedicationPayload>;

export function listLongTermMedications(
  patientId: string,
  signal?: AbortSignal,
): Promise<LongTermMedicationListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/long-term-medications`, { signal });
}

export function createLongTermMedication(
  patientId: string,
  payload: CreateLongTermMedicationPayload,
): Promise<{ patientLongTermMedicineId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/long-term-medications`, {
    method: "POST",
    body: payload,
  });
}

export function updateLongTermMedication(
  patientId: string,
  medicationId: string,
  payload: UpdateLongTermMedicationPayload,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/long-term-medications/${encodeURIComponent(medicationId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteLongTermMedication(patientId: string, medicationId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/long-term-medications/${encodeURIComponent(medicationId)}`,
    { method: "DELETE" },
  );
}

// ---- Problems ----

export interface ProblemListItem {
  patientProblemId: string;
  problemText: string;
  problemCategory: number; // 1=Active 2=Resolved 3=Inactive 4=History
  onsetDate: string | null;
  lastOccurenceDate: string | null;
  isActive: boolean;
}

export interface CreateProblemPayload {
  problemText: string;
  problemCategory?: number;
  onsetDate?: string | null;
  lastOccurenceDate?: string | null;
  isActive?: boolean;
}

export type UpdateProblemPayload = Partial<CreateProblemPayload>;

export const PROBLEM_CATEGORY_LABEL: Record<number, string> = {
  1: "Active",
  2: "Resolved",
  3: "Inactive",
  4: "History",
};

export function listProblems(
  patientId: string,
  signal?: AbortSignal,
): Promise<ProblemListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/problems`, { signal });
}

export function createProblem(
  patientId: string,
  payload: CreateProblemPayload,
): Promise<{ patientProblemId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/problems`, {
    method: "POST",
    body: payload,
  });
}

export function updateProblem(
  patientId: string,
  problemId: string,
  payload: UpdateProblemPayload,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/problems/${encodeURIComponent(problemId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteProblem(patientId: string, problemId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/problems/${encodeURIComponent(problemId)}`,
    { method: "DELETE" },
  );
}

// ---- Family History (Hereditary Diseases) ----

export interface FamilyHistoryItem {
  pfiHereditaryDiseasesId: string;
  medicalConditionId: string;
  conditionName: string;
  description: string | null;
}

export interface CreateFamilyHistoryPayload {
  medicalConditionId: string;
  description?: string | null;
}

export function listFamilyHistory(
  patientId: string,
  signal?: AbortSignal,
): Promise<FamilyHistoryItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/family-history`, { signal });
}

export function createFamilyHistory(
  patientId: string,
  payload: CreateFamilyHistoryPayload,
): Promise<{ pfiHereditaryDiseasesId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/family-history`, {
    method: "POST",
    body: payload,
  });
}

export function deleteFamilyHistory(patientId: string, itemId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/family-history/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

// ---- Immunizations ----

export interface ImmunizationListItem {
  patientImmunizationId: string;
  immunizationsVaccineId: string;
  vaccineName: string;
  vaccineType: string | null;
  dose: string | null;
  ageAdministered: string | null;
  dateAdministered: string | null;
  lotNumber: string | null;
  physician: string | null;
}

export interface VaccineListItem {
  immunizationsVaccineId: string;
  name: string;
}

export interface CreateImmunizationPayload {
  immunizationsVaccineId: string;
  vaccineType?: string | null;
  dose?: string | null;
  ageAdministered?: string | null;
  dateAdministered?: string | null;
  lotNumber?: string | null;
  physician?: string | null;
}

export function listImmunizations(
  patientId: string,
  signal?: AbortSignal,
): Promise<ImmunizationListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/immunizations`, { signal });
}

export function createImmunization(
  patientId: string,
  payload: CreateImmunizationPayload,
): Promise<{ patientImmunizationId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/immunizations`, {
    method: "POST",
    body: payload,
  });
}

export function deleteImmunization(patientId: string, itemId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/immunizations/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

export function listVaccines(signal?: AbortSignal): Promise<VaccineListItem[]> {
  return api("/coding/vaccines", { signal });
}

// ---- Lab Requests ----

export interface LabRequestListItem {
  patientLabRequestId: string;
  labRequest: string;
  lab: string | null;
  requestDate: string;
  expectedDeliveryDate: string;
  isDelivered: boolean;
  deliveryDate: string | null;
}

export interface CreateLabRequestPayload {
  labRequest: string;
  lab?: string | null;
  requestDate: string;
  expectedDeliveryDate: string;
}

export interface UpdateLabRequestPayload {
  isDelivered?: boolean;
  deliveryDate?: string | null;
  labRequest?: string;
  lab?: string | null;
}

export function listLabRequests(
  patientId: string,
  signal?: AbortSignal,
): Promise<LabRequestListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/lab-requests`, { signal });
}

export function createLabRequest(
  patientId: string,
  payload: CreateLabRequestPayload,
): Promise<{ patientLabRequestId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/lab-requests`, {
    method: "POST",
    body: payload,
  });
}

export function updateLabRequest(
  patientId: string,
  labRequestId: string,
  payload: UpdateLabRequestPayload,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/lab-requests/${encodeURIComponent(labRequestId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteLabRequest(patientId: string, labRequestId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/lab-requests/${encodeURIComponent(labRequestId)}`,
    { method: "DELETE" },
  );
}
