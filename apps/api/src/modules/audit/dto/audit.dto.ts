import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

/** Query params on GET /v1/audit. All filters are AND-composed. */
export class ListAuditDto {
  /** ISO date or datetime (inclusive). Defaults to 7 days ago. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  /** CSV list of actions: Create,Update,Delete,Export,Print,Login,LoginFailed,Logout (case-sensitive). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  /** success | denied | error */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  /** Free-text — currently matches entityId. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export interface AuditEventDto {
  auditId: number;
  eventTime: string;
  user: { userId: string; userName: string | null; fullName: string | null };
  ipAddress: string;
  userAgent: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  patient: { patientId: string; fullName: string | null } | null;
  outcome: string;
  errorMessage: string | null;
  correlationId: string;
}

export interface AuditEventDetailDto extends AuditEventDto {
  changedFields: string[] | null;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface AuditListResponse {
  data: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    actions: FacetBucket[];
    entityTypes: FacetBucket[];
    users: FacetBucket[];
    outcomes: FacetBucket[];
  };
}

export interface AuditSummaryResponse {
  /** Inclusive day list (YYYY-MM-DD), one bucket per day. */
  days: string[];
  byDay: Array<{ date: string; total: number; failed: number }>;
  totals: { total: number; failed: number };
  topAction: { action: string; count: number } | null;
  topUser: { userId: string; userName: string | null; fullName: string | null; count: number } | null;
}
