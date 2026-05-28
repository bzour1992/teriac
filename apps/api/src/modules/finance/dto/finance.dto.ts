import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

// ── Transaction types ─────────────────────────────────────────────────────────

export const TRANSACTION_TYPES = {
  Income: 1,
  Expense: 2,
  Refund: 3,
  Transfer: 4,
  Salary: 5,
  Adjustment: 6,
} as const;

export const TRANSACTION_TYPE_LABEL: Record<number, string> = {
  0: "Transaction",  // legacy records with no explicit type
  1: "Income",
  2: "Expense",
  3: "Refund",
  4: "Transfer",
  5: "Salary",
  6: "Adjustment",
};

// ── Wallets ───────────────────────────────────────────────────────────────────

export interface WalletItem {
  walletId: string;
  walletName: string;
  isDefault: boolean;
  isSystem: boolean;
  isCashBox: boolean;
  balance?: number;
}

export class CreateWalletDto {
  @IsString() @IsNotEmpty() @MaxLength(250) walletName!: string;
  @IsOptional() isCashBox?: boolean;
}

export class TransferDto {
  @IsUUID('all') fromWalletId!: string;
  @IsUUID('all') toWalletId!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsOptional() @MaxLength(500) notes?: string;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TransactionItem {
  hcenterFinancalTransactionId: string;
  addDate: string;
  transactionType: number;
  transactionTypeLabel: string;
  details: string;
  amount: number;
  discount: number;
  notes: string | null;
  ifNumber: string | null;
  walletName: string | null;
  categoryName: string | null;
  patientName: string | null;
  addedByName: string | null;
}

export interface TransactionListResponse {
  data: TransactionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListTransactionsQueryDto {
  @IsString() @IsOptional() from?: string;
  @IsString() @IsOptional() to?: string;
  @IsUUID('all') @IsOptional() walletId?: string;
  @IsInt() @Min(1) @Max(6) @IsOptional() @Type(() => Number) type?: number;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() @Type(() => Number) pageSize?: number;
}

export class CreateTransactionDto {
  @IsString() @IsNotEmpty() @MaxLength(500) details!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsInt() @Min(1) @Max(6) transactionType!: number;
  @IsNumber() @Min(0) @IsOptional() discount?: number;
  @IsString() @IsOptional() notes?: string | null;
  @IsString() @IsOptional() ifNumber?: string | null;
  @IsUUID('all') @IsOptional() walletId?: string | null;
  @IsUUID('all') @IsOptional() transactionCategoryId?: string | null;
  @IsUUID('all') @IsOptional() patientId?: string | null;
  @IsUUID('all') @IsOptional() ownerUserId?: string | null;
  @IsString() @IsOptional() employeeName?: string | null;
}

export class UpdateTransactionDto {
  @IsString() @IsNotEmpty() @MaxLength(500) @IsOptional() details?: string;
  @IsNumber() @Min(0) @IsOptional() amount?: number;
  @IsString() @IsOptional() notes?: string | null;
  @IsString() @IsOptional() ifNumber?: string | null;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface PnlReport {
  from: string;
  to: string;
  totalIncome: number;
  totalExpenses: number;
  totalRefunds: number;
  totalSalary: number;
  totalAdjustments: number;
  netProfit: number;
  transactionCount: number;
}

export interface DailyReport {
  date: string;
  income: number;
  expenses: number;
  refunds: number;
  net: number;
  count: number;
}

export interface DoctorRevenueItem {
  doctorId: string;
  doctorName: string;
  totalRevenue: number;
  transactionCount: number;
}
