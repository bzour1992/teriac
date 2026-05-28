import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { BillingRecordsController } from "./billing-records.controller";
import { BillingRecordsService } from "./billing-records.service";
import { BillingInvoicesController, InvoicesController, PatientsInvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { AdminOnlyGuard } from "../../common/auth/admin-only.guard";
import { TenantContextService } from "../../common/tenant/tenant-context";

@Module({
  controllers: [
    CategoriesController,
    BillingRecordsController,
    BillingInvoicesController,
    InvoicesController,
    PatientsInvoicesController,
  ],
  providers: [
    CategoriesService,
    BillingRecordsService,
    InvoicesService,
    AdminOnlyGuard,
    TenantContextService,
  ],
})
export class BillingModule {}
