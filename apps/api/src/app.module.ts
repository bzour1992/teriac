import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClsModule } from "nestjs-cls";
import { resolve } from "node:path";
import { DbModule } from "./db/db.module";
import { AuditModule } from "./common/audit/audit.module";
import { ModulesAccessModule } from "./common/modules/modules.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { VisitsModule } from "./modules/visits/visits.module";
import { CodingModule } from "./modules/coding/coding.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { UsersModule } from "./modules/users/users.module";
import { BillingModule } from "./modules/billing/billing.module";
import { AdminModule } from "./modules/admin/admin.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { FieldRulesModule } from "./modules/field-rules/field-rules.module";
import { SuperadminModule } from "./modules/superadmin/superadmin.module";
import { AuditReadModule } from "./modules/audit/audit-read.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";

// Workspace root .env is two levels above apps/api/ (the dev cwd).
const ENV_PATHS = [
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env"),
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_PATHS,
    }),
    // Continuation-Local Storage — carries tenant context across async boundaries
    // without leaking request state into shared services.
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req) =>
          (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID(),
      },
    }),
    DbModule,
    AuditModule,
    // AuthModule's APP_GUARD must register BEFORE ModulesAccessModule's so the
    // JWT guard runs first — otherwise an unauthenticated request to a
    // @RequiresModule route reports MODULE_DISABLED instead of 401.
    AuthModule,
    ModulesAccessModule,
    PatientsModule,
    VisitsModule,
    CodingModule,
    SchedulingModule,
    UsersModule,
    BillingModule,
    AdminModule,
    ReportsModule,
    FinanceModule,
    FieldRulesModule,
    SuperadminModule,
    AuditReadModule,
    AttachmentsModule,
    HealthModule,
  ],
})
export class AppModule {}
