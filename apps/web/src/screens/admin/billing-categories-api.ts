import { api } from "../../lib/api/client";

export interface BillingCategoryItem {
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

export interface PriceTierLabels {
  price2Label: string | null;
  price3Label: string | null;
}

export interface BillingCategoriesResponse {
  data: BillingCategoryItem[];
  tierLabels: PriceTierLabels;
}

export interface CreateBillingCategoryPayload {
  name: string;
  isIncome?: boolean;
  isCheckup?: boolean;
  defaultPrice: number;
  price2?: number | null;
  price3?: number | null;
}

export interface UpdateBillingCategoryPayload {
  name?: string;
  defaultPrice?: number;
  price2?: number | null;
  price3?: number | null;
  isIncome?: boolean;
  isCheckup?: boolean;
  isArchived?: boolean;
}

export function listBillingCategories(signal?: AbortSignal): Promise<BillingCategoriesResponse> {
  return api("/finance/categories", { signal });
}

export function createBillingCategory(
  body: CreateBillingCategoryPayload,
): Promise<{ transactionCategoryId: string }> {
  return api("/finance/categories", { method: "POST", body });
}

export function updateBillingCategory(
  id: string,
  body: UpdateBillingCategoryPayload,
): Promise<void> {
  return api(`/finance/categories/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function deleteBillingCategory(
  id: string,
): Promise<{ deleted: boolean; archived: boolean; usageCount: number }> {
  return api(`/finance/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function setPriceTierLabels(body: {
  price2Label?: string | null;
  price3Label?: string | null;
}): Promise<PriceTierLabels> {
  return api("/finance/categories/tier-labels", { method: "PUT", body });
}
