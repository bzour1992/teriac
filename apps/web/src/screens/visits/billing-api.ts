import { api } from "../../lib/api/client";

export interface CategoryListItem {
  transactionCategoryId: string;
  name: string;
  isIncome: boolean;
  isCheckup: boolean;
  defaultPrice: number;
  price2: number | null;
  price3: number | null;
  isSystem: boolean;
  isArchived: boolean;
  usageCount: number;
  lastUsedAt: string | null;
}

export interface CategoriesResponse {
  data: CategoryListItem[];
  tierLabels: { price2Label: string | null; price3Label: string | null };
}

export interface BillingRecordItem {
  patientBillingRecordId: string;
  transactionCategoryId: string;
  categoryName: string;
  details: string;
  expense: number;
  isLocked: boolean;
  recordDate: string;
  doctorId: string | null;
  ifNumber: string | null;
}

export interface InvoiceListItem {
  patientInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  paidByPatient: number;
  finalBalance: number;
  discount: number;
  totalCharged: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  oldBalance: number;
  coveredByHealthInsurance: number | null;
  coveredByHospital: number | null;
  patientInsuranceDetailId: string | null;
  hospitalName: string | null;
  records: BillingRecordItem[];
}

export interface AddRecordPayload {
  transactionCategoryId: string;
  expense: number;
  details?: string;
  doctorId?: string;
}

export interface CreateInvoicePayload {
  patientId: string;
  billingRecordIds: string[];
  paidByPatient: number;
  discount?: number;
  coveredByHealthInsurance?: number;
  coveredByHospital?: number;
  patientInsuranceDetailId?: string;
  hospitalName?: string;
}

export function listCategories(signal?: AbortSignal): Promise<CategoriesResponse> {
  return api("/finance/categories", { signal });
}

export function listBillingRecords(
  visitId: string,
  signal?: AbortSignal,
): Promise<BillingRecordItem[]> {
  return api(`/visits/${encodeURIComponent(visitId)}/billing-records`, { signal });
}

export function addBillingRecord(
  visitId: string,
  payload: AddRecordPayload,
): Promise<{ patientBillingRecordId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/billing-records`, {
    method: "POST",
    body: payload,
  });
}

export function deleteBillingRecord(visitId: string, recordId: string): Promise<void> {
  return api(
    `/visits/${encodeURIComponent(visitId)}/billing-records/${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );
}

export function createInvoice(
  payload: CreateInvoicePayload,
): Promise<{ patientInvoiceId: string; invoiceNumber: string }> {
  return api("/invoices", { method: "POST", body: payload });
}

export function getInvoice(invoiceId: string, signal?: AbortSignal): Promise<InvoiceDetail> {
  return api(`/invoices/${encodeURIComponent(invoiceId)}`, { signal });
}

export function listPatientInvoices(
  patientId: string,
  signal?: AbortSignal,
): Promise<InvoiceListItem[]> {
  return api(`/patients/${encodeURIComponent(patientId)}/invoices`, { signal });
}
