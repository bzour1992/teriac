import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

// ── Transaction Categories ────────────────────────────────────────────────────

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
  /** Number of patientbillingrecords + hcenterfinancaltransactions
   *  referencing this category. Drives the "in use" admin column. */
  usageCount: number;
  lastUsedAt: string | null;
}

export interface PriceTierLabels {
  price2Label: string | null;
  price3Label: string | null;
}

export interface CategoriesListResponse {
  data: CategoryListItem[];
  tierLabels: PriceTierLabels;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name!: string;

  @IsBoolean()
  @IsOptional()
  isIncome?: boolean;

  @IsBoolean()
  @IsOptional()
  isCheckup?: boolean;

  @IsNumber()
  @Min(0)
  defaultPrice!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price2?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price3?: number | null;
}

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price2?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price3?: number | null;

  @IsBoolean()
  @IsOptional()
  isIncome?: boolean;

  @IsBoolean()
  @IsOptional()
  isCheckup?: boolean;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}

export class UpdateTierLabelsDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  price2Label?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  price3Label?: string | null;
}

// ── Billing Records ───────────────────────────────────────────────────────────

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

export class CreateBillingRecordDto {
  @IsUUID('all')
  transactionCategoryId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  details?: string;

  @IsNumber()
  @Min(0)
  expense!: number;

  @IsUUID('all')
  @IsOptional()
  doctorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ifNumber?: string;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

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

export interface BillingInvoiceItem {
  patientInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  patient: { patientId: string; fullName: string; fullNameAr: string | null; nationalId: string };
  totalCharged: number;
  paidByPatient: number;
  discount: number;
  coveredByHealthInsurance: number | null;
  coveredByHospital: number | null;
  finalBalance: number;
}

export interface BillingInvoiceListResponse {
  data: BillingInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalInvoiced: number;
    totalCollected: number;
    totalOutstanding: number;
    count: number;
  };
}

export class ListInvoicesQueryDto {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export class CreateInvoiceDto {
  @IsUUID('all')
  patientId!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  billingRecordIds!: string[];

  @IsNumber()
  @Min(0)
  paidByPatient!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coveredByHealthInsurance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coveredByHospital?: number;

  @IsUUID('all')
  @IsOptional()
  patientInsuranceDetailId?: string;

  @IsString()
  @MaxLength(250)
  @IsOptional()
  hospitalName?: string;
}
