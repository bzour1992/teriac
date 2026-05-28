import type { TransactionType } from "../enums/index";

export interface PatientInvoice {
  patientInvoiceId: string;
  patientId: string;
  hcenterId: string;
  addedByUserId: string;
  invoiceNumber: string;
  invoiceDate: string;
  creationDate: string;
  paidByPatient: number;
  oldBalance: number;
  finalBalance: number;
  coveredByHealthInsurance?: number | null;
  coveredByHospital?: number | null;
  discount: number;
  patientInsuranceDetailId?: string | null;
  hospitalName?: string | null;
  migrated: boolean;
}

export interface FinancialTransaction {
  /** DB table is misspelled `hcenterfinancaltransactions`. */
  hcenterFinancialTransactionId: string;
  hcenterId: string;
  details: string;
  amount: number;
  originalAmount?: number | null;
  discount: number;
  transactionType: TransactionType;
  notes?: string | null;
  addDate: string;
  addUserId: string;
  updateDate?: string | null;
  updateUserId?: string | null;
  ownerUserId?: string | null;
  ifNumber?: string | null;
  walletId?: string | null;
  sourceWallet?: string | null;
  patientId?: string | null;
  patientInvoiceId?: string | null;
  patientBillingRecordId?: string | null;
  patientInsuranceDetailId?: string | null;
  transactionCategoryId?: string | null;
  employeeName?: string | null;
  employeeNumber?: string | null;
  employeeUserId?: string | null;
  inventoryItemId?: string | null;
}

export interface Wallet {
  walletId: string;
  hcenterId: string;
  walletName: string;
  isDefault: boolean;
  isSystem: boolean;
  /** DB column is misspelled `IsCacheBox` (means CashBox). */
  isCashBox: boolean;
}
