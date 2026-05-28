import { api } from "../../lib/api/client";

export interface VisitDetail {
  patientVisitId: string;
  visitDate: string;
  outcome: number;
  intensity: number;
  visitType: number;
  painLevel: number;
  isHospitalCase: boolean;
  hospitalName: string | null;
  parentVisitId: string | null;
  dateAdded: string | null;
  chiefComplaint: string | null;
  historyOfPresentIllness: string | null;
  pastMedicalHistory: string | null;
  notes: string | null;
  recommendations: string | null;
  disposition: string | null;
  sourceOfReferral: string | null;
  transferTo: string | null;
  destinationOfReferral: string | null;
  patient: {
    patientId: string;
    nationalId: string;
    fullName: string;
    fullNameAr: string | null;
    sex: number;
    dateOfBirth: string | null;
  };
  doctor: {
    userId: string;
    fullName: string;
    speciality: string | null;
  } | null;
  diagnoses: Array<{
    pvAssessmentConditionId: string;
    medicalConditionId: string;
    conditionName: string;
    dateDiagnosed: string | null;
    ageOfOnset: string | null;
    conditionStatus: string | null;
    comments: string | null;
  }>;
  prescriptions: Array<{
    pvPlanMedicationId: string;
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
    prescriptionDate: string | null;
    notes: string | null;
    isPrescribed: boolean;
    diagnosisName: string | null;
  }>;
  pmhConditions: Array<{
    pvPmhConditionId: string;
    conditionName: string;
    dateDiagnosed: string | null;
    ageOfOnset: string | null;
    conditionStatus: string | null;
  }>;
  pmhMedications: Array<{
    pvPmhMedicationId: string;
    medicineName: string;
    scientificName: string | null;
    dose: string | null;
    period: string | null;
    indication: string | null;
  }>;
  afterVisitRecommendations: Array<{
    afterVisitRecommendationId: string;
    recommended: string;
    isDone: boolean;
    requestDate: string;
    processedDate: string | null;
  }>;
}

export type VisitPrescription = VisitDetail["prescriptions"][number];

export function getVisit(visitId: string, signal?: AbortSignal): Promise<VisitDetail> {
  return api<VisitDetail>(`/visits/${encodeURIComponent(visitId)}`, { signal });
}

export interface CreateVisitPayload {
  patientId: string;
  visitType: number;
  visitDate?: string;
  doctorUserId?: string;
  intensity?: number;
  painLevel?: number;
  chiefComplaint?: string | null;
  historyOfPresentIllness?: string | null;
}

export function createVisit(payload: CreateVisitPayload): Promise<{ patientVisitId: string }> {
  return api("/visits", { method: "POST", body: payload });
}

export interface UpdateVisitPayload {
  chiefComplaint?: string | null;
  historyOfPresentIllness?: string | null;
  pastMedicalHistory?: string | null;
  notes?: string | null;
  recommendations?: string | null;
  disposition?: string | null;
  outcome?: number;
  intensity?: number;
  visitType?: number;
  painLevel?: number;
  isHospitalCase?: boolean;
  hospitalName?: string | null;
  sourceOfReferral?: string | null;
  transferTo?: string | null;
  destinationOfReferral?: string | null;
}

export function updateVisit(
  visitId: string,
  payload: UpdateVisitPayload,
): Promise<VisitDetail> {
  return api<VisitDetail>(`/visits/${encodeURIComponent(visitId)}`, {
    method: "PATCH",
    body: payload,
  });
}

// ---- Prescriptions ----

export interface CreatePrescriptionPayload {
  medicineId: string;
  pvAssessmentConditionId?: string | null;
  indication?: string | null;
  dose?: string | null;
  period?: string | null;
  frequency?: number | null;
  frequencyUnit?: string | null;
  quantityNumber?: string | null;
  quantityForm?: string | null;
  route?: string | null;
  notes?: string | null;
  isPrescribed?: boolean;
}

export type UpdatePrescriptionPayload = Partial<CreatePrescriptionPayload>;

export function createPrescription(
  visitId: string,
  payload: CreatePrescriptionPayload,
): Promise<{ pvPlanMedicationId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/prescriptions`, {
    method: "POST",
    body: payload,
  });
}

export function updatePrescription(
  visitId: string,
  rxId: string,
  payload: UpdatePrescriptionPayload,
): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/prescriptions/${encodeURIComponent(rxId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deletePrescription(visitId: string, rxId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/prescriptions/${encodeURIComponent(rxId)}`,
    { method: "DELETE" },
  );
}

// ---- Diagnoses ----

export type DiagnosisStatus = "Active" | "Resolved" | "Chronic" | "Inactive";

export interface CreateDiagnosisPayload {
  medicalConditionId: string;
  dateDiagnosed?: string | null;
  ageOfOnset?: string | null;
  conditionStatus?: DiagnosisStatus | null;
  comments?: string | null;
}

export type UpdateDiagnosisPayload = Partial<CreateDiagnosisPayload>;

export function createDiagnosis(
  visitId: string,
  payload: CreateDiagnosisPayload,
): Promise<{ pvAssessmentConditionId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/diagnoses`, {
    method: "POST",
    body: payload,
  });
}

export function updateDiagnosis(
  visitId: string,
  dxId: string,
  payload: UpdateDiagnosisPayload,
): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/diagnoses/${encodeURIComponent(dxId)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteDiagnosis(visitId: string, dxId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/diagnoses/${encodeURIComponent(dxId)}`,
    { method: "DELETE" },
  );
}

export type VisitDiagnosis = VisitDetail["diagnoses"][number];

// ---- Revisits ----

export interface RevisitItem {
  pvRevisitId: string;
  revisitDate: string;
  notes: string | null;
  comments: string | null;
}

export function listRevisits(visitId: string, signal?: AbortSignal): Promise<RevisitItem[]> {
  return api<RevisitItem[]>(`/visits/${encodeURIComponent(visitId)}/revisits`, { signal });
}

export function createRevisit(
  visitId: string,
  payload: { revisitDate: string; notes?: string; comments?: string },
): Promise<{ pvRevisitId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/revisits`, {
    method: "POST",
    body: payload,
  });
}

export function deleteRevisit(visitId: string, revId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/revisits/${encodeURIComponent(revId)}`,
    { method: "DELETE" },
  );
}

// ---- Recommendations write ----

export function createRecommendation(
  visitId: string,
  payload: { recommended: string },
): Promise<{ afterVisitRecommendationId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/recommendations`, {
    method: "POST",
    body: payload,
  });
}

export function processRecommendation(visitId: string, recId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/recommendations/${encodeURIComponent(recId)}/process`,
    { method: "PATCH" },
  );
}

export function deleteRecommendation(visitId: string, recId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/recommendations/${encodeURIComponent(recId)}`,
    { method: "DELETE" },
  );
}

// ---- Body system review (ROS) ----

export interface RosEntry {
  patientBodySystemReviewId: string;
  bodySystemId: string;
  bodySystemName: string;
  isNormal: boolean;
  notes: string | null;
}

export function getBodySystemReview(visitId: string, signal?: AbortSignal): Promise<RosEntry[]> {
  return api<RosEntry[]>(`/visits/${encodeURIComponent(visitId)}/body-system-review`, { signal });
}

export function saveBodySystemReview(
  visitId: string,
  items: Array<{ bodySystemId: string; isNormal: boolean; notes?: string }>,
): Promise<{ lotGuid: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/body-system-review`, {
    method: "POST",
    body: { items },
  });
}

// ---- Physical exam ----

export interface PeEntry {
  patientBodySystemPhysicalExamId: string;
  bodySystemId: string;
  bodySystemName: string;
  isNormal: boolean;
  notes: string | null;
}

export function getPhysicalExam(visitId: string, signal?: AbortSignal): Promise<PeEntry[]> {
  return api<PeEntry[]>(`/visits/${encodeURIComponent(visitId)}/physical-exam`, { signal });
}

export function savePhysicalExam(
  visitId: string,
  items: Array<{ bodySystemId: string; isNormal: boolean; notes?: string }>,
): Promise<{ lotGuid: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/physical-exam`, {
    method: "POST",
    body: { items },
  });
}

// ---- Body systems reference ----

export interface BodySystem {
  bodySystemId: string;
  name: string;
  order: number;
}

export function listBodySystems(signal?: AbortSignal): Promise<BodySystem[]> {
  return api<BodySystem[]>("/coding/body-systems", { signal });
}
