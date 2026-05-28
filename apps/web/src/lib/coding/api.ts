import { api } from "../api/client";

export interface MedicineSuggestion {
  medicineId: string;
  tradeName: string;
  scientificName: string | null;
  countryCode: string | null;
}

export function searchMedicines(
  q: string,
  signal?: AbortSignal,
): Promise<MedicineSuggestion[]> {
  return api<MedicineSuggestion[]>("/medicines", {
    query: { q, limit: 20 },
    signal,
  });
}

export interface MedicalConditionSuggestion {
  medicalConditionId: string;
  name: string;
  category: string | null;
  isChronic: boolean;
  isAllergy: boolean;
  isHereditary: boolean;
  isVerified: boolean;
}

export function searchMedicalConditions(
  q: string,
  signal?: AbortSignal,
  opts?: { category?: "allergy" | "chronic" | "hereditary" },
): Promise<MedicalConditionSuggestion[]> {
  return api<MedicalConditionSuggestion[]>("/medical-conditions", {
    query: { q, limit: 20, category: opts?.category },
    signal,
  });
}

// ── ICD-10 ────────────────────────────────────────────────────────────────────

export interface Icd10Suggestion {
  icd10Id: number;
  code: string;
  shortDesc: string;
  longDesc: string | null;
  billable: boolean;
}

export function searchIcd10(
  q: string,
  signal?: AbortSignal,
  opts?: { billableOnly?: boolean; limit?: number },
): Promise<Icd10Suggestion[]> {
  return api<Icd10Suggestion[]>("/coding/icd10", {
    query: {
      q,
      limit: String(opts?.limit ?? 20),
      ...(opts?.billableOnly ? { billableOnly: "true" } : {}),
    },
    signal,
  });
}

export function resolveIcd10(
  code: string,
  shortDesc: string,
): Promise<{ medicalConditionId: string; conditionName: string; icd10Code: string }> {
  return api("/coding/icd10/resolve", { method: "POST", body: { code, shortDesc } });
}

// ── CPT ───────────────────────────────────────────────────────────────────────

export interface CptSuggestion {
  cptCodeId: string;
  cptCode: string;
  shortDescription: string;
  longDescription: string | null;
  sgroup: string | null;
}

export function searchCpt(
  q: string,
  signal?: AbortSignal,
  opts?: { limit?: number },
): Promise<CptSuggestion[]> {
  return api<CptSuggestion[]>("/coding/cpt", {
    query: { q, limit: String(opts?.limit ?? 20) },
    signal,
  });
}
