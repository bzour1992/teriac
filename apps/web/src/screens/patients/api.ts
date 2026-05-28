import { api } from "../../lib/api/client";

export interface PatientListItem {
  patientId: string;
  nationalId: string;
  fullName: string;
  fullNameAr: string | null;
  sex: number;
  dateOfBirth: string | null;
  mobileNumber: string | null;
  email: string | null;
  photoUrl: string | null;
}

export interface PatientListResponse {
  data: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListPatientsParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listPatients(
  params: ListPatientsParams,
  signal?: AbortSignal,
): Promise<PatientListResponse> {
  return api<PatientListResponse>("/patients", {
    query: { q: params.q, page: params.page, pageSize: params.pageSize },
    signal,
  });
}

export interface PatientDetail {
  patientId: string;
  nationalId: string;
  prefix: string | null;
  firstName: string | null;
  secondName: string | null;
  thirdName: string | null;
  lastName: string | null;
  fullName: string;
  fullNameAr: string | null;
  sex: number;
  dateOfBirth: string | null;
  age: { years: number; months: number } | null;
  height: number | null;
  weight: number | null;
  whUnit: string | null;
  mobileNumber: string | null;
  email: string | null;
  address: string | null;
  photoUrl: string | null;
  passportNumber: string | null;
  nationality: string | null;
  humanRaceId: string | null;
  maritalStatusId: string | null;
  schoolPerformance: number;
  fatherEducation: string | null;
  fatherOccupation: string | null;
  motherEducation: string | null;
  motherOccupation: string | null;
  childOrder: number | null;
  childrenCount: number | null;
  dateAdded: string | null;
  patientCreationMethod: number;
  arabicInfo: {
    firstNameAr: string | null;
    secondNameAr: string | null;
    thirdNameAr: string | null;
    lastNameAr: string | null;
  } | null;
  additionalInfo: {
    occupation: string | null;
    organization: string | null;
    poBox: string | null;
    zipCode: string | null;
    homeEnvironment: string | null;
  } | null;
  emergencyContact: {
    name: string | null;
    relation: string | null;
    phoneNumber: string | null;
  };
  summary: {
    allergyCount: number;
    chronicDiseaseCount: number;
    longTermMedicationCount: number;
    activeProblemCount: number;
    activeInsuranceCount: number;
    visitCount: number;
    lastVisitDate: string | null;
  };
  recentVisits: Array<{
    patientVisitId: string;
    visitDate: string;
    chiefComplaint: string | null;
    outcome: number;
  }>;
  specialNotes: Array<{
    patientSpecialNoteId: string;
    note: string;
  }>;
}

export function getPatient(patientId: string, signal?: AbortSignal): Promise<PatientDetail> {
  return api<PatientDetail>(`/patients/${encodeURIComponent(patientId)}`, { signal });
}

export interface UpdatePatientPayload {
  prefix?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  thirdName?: string | null;
  lastName?: string | null;
  firstNameAr?: string | null;
  secondNameAr?: string | null;
  thirdNameAr?: string | null;
  lastNameAr?: string | null;
  nationalId?: string;
  sex?: number;
  dateOfBirth?: string;
  passportNumber?: string | null;
  religion?: string | null;
  nationality?: string | null;
  humanRaceId?: string | null;
  maritalStatusId?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
  address?: string | null;
  contactPersonName?: string | null;
  contactRelation?: string | null;
  contactPhoneNumber?: string | null;
  height?: number | null;
  weight?: number | null;
  whUnit?: string | null;
}

export function updatePatient(patientId: string, payload: UpdatePatientPayload): Promise<void> {
  return api(`/patients/${encodeURIComponent(patientId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export interface CreatePatientPayload {
  // Optional — backend falls back to AUTO-<id> when missing.
  nationalId?: string | null;
  sex: number;
  // Optional — backend falls back to 1900-01-01 when missing.
  dateOfBirth?: string | null;
  prefix?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  thirdName?: string | null;
  lastName?: string | null;
  firstNameAr?: string | null;
  secondNameAr?: string | null;
  thirdNameAr?: string | null;
  lastNameAr?: string | null;
  passportNumber?: string | null;
  religion?: string | null;
  nationality?: string | null;
  humanRaceId?: string | null;
  maritalStatusId?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
  address?: string | null;
  contactPersonName?: string | null;
  contactRelation?: string | null;
  contactPhoneNumber?: string | null;
}

export function createPatient(payload: CreatePatientPayload): Promise<{ patientId: string }> {
  return api("/patients", { method: "POST", body: payload });
}

// ---- Arabic info ----

export interface ArabicInfoPayload {
  firstNameAr?: string | null;
  secondNameAr?: string | null;
  thirdNameAr?: string | null;
  lastNameAr?: string | null;
}

export function updateArabicInfo(patientId: string, payload: ArabicInfoPayload): Promise<void> {
  return api(`/patients/${encodeURIComponent(patientId)}/arabic-info`, {
    method: "PUT",
    body: payload,
  });
}

// ---- Additional info ----

export interface AdditionalInfo {
  occupation: string | null;
  organization: string | null;
  dailyRoutine: string | null;
  dietaryPatterns: string | null;
  sleepPatterns: string | null;
  exercisePatterns: string | null;
  poBox: string | null;
  zipCode: string | null;
  homeEnvironment: string | null;
}

export function updateAdditionalInfo(
  patientId: string,
  payload: Partial<AdditionalInfo>,
): Promise<void> {
  return api(`/patients/${encodeURIComponent(patientId)}/additional-info`, {
    method: "PUT",
    body: payload,
  });
}

// ---- Substance use ----

export interface SubstanceUse {
  liveWithSmokers: boolean;
  parentsWereSmokers: boolean;
  smokedBefore: boolean;
  stillSmoking: boolean;
  cigarettesNumber: number | null;
  cigarettesStartYear: number | null;
  cigarettesStopYear: number | null;
  sheeshaHeadNumber: number | null;
  sheeshaStartYear: number | null;
  sheeshaStopYear: number | null;
  totalPackYear: number | null;
  smokingComments: string | null;
  alcoholic: boolean;
  pastAlcoholic: boolean;
  excessiveAlcoholUse: boolean;
  beerNumber: number | null;
  wineNumber: number | null;
  liquorNumber: number | null;
  drinkingComments: string | null;
  drugUser: boolean;
  drugComments: string | null;
}

export function getSubstanceUse(
  patientId: string,
  signal?: AbortSignal,
): Promise<SubstanceUse | null> {
  return api<SubstanceUse | null>(
    `/patients/${encodeURIComponent(patientId)}/substance-use`,
    { signal },
  );
}

export function updateSubstanceUse(
  patientId: string,
  payload: Partial<SubstanceUse>,
): Promise<void> {
  return api(`/patients/${encodeURIComponent(patientId)}/substance-use`, {
    method: "PUT",
    body: payload,
  });
}

// ---- Insurance ----

export interface InsuranceItem {
  patientInsuranceDetailId: string;
  insuranceCompany: string;
  insuranceLevel: string | null;
  coveragePercentage: number | null;
  insuranceCardNumber: string | null;
  isActive: boolean;
  participantName: string | null;
  participantCompany: string | null;
  relationToParticipant: string | null;
  notes: string | null;
}

export function listInsurance(
  patientId: string,
  signal?: AbortSignal,
): Promise<InsuranceItem[]> {
  return api<InsuranceItem[]>(
    `/patients/${encodeURIComponent(patientId)}/insurance`,
    { signal },
  );
}

export function createInsurance(
  patientId: string,
  payload: Omit<InsuranceItem, "patientInsuranceDetailId">,
): Promise<{ patientInsuranceDetailId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/insurance`, {
    method: "POST",
    body: payload,
  });
}

export function updateInsurance(
  patientId: string,
  iid: string,
  payload: Partial<Omit<InsuranceItem, "patientInsuranceDetailId">>,
): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/insurance/${encodeURIComponent(iid)}`,
    { method: "PATCH", body: payload },
  );
}

export function deleteInsurance(patientId: string, iid: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/insurance/${encodeURIComponent(iid)}`,
    { method: "DELETE" },
  );
}

// ---- Notes ----

export function createNote(
  patientId: string,
  note: string,
): Promise<{ patientSpecialNoteId: string }> {
  return api(`/patients/${encodeURIComponent(patientId)}/notes`, {
    method: "POST",
    body: { note },
  });
}

export function deleteNote(patientId: string, noteId: string): Promise<void> {
  return api(
    `/patients/${encodeURIComponent(patientId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE" },
  );
}
