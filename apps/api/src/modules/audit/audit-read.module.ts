import { Module } from "@nestjs/common";
import { TenantContextService } from "../../common/tenant/tenant-context";
import { AdminOnlyGuard } from "../../common/auth/admin-only.guard";
import { AuditReadController } from "./audit-read.controller";
import { AuditReadService } from "./audit-read.service";

@Module({
  controllers: [AuditReadController],
  providers: [AuditReadService, AdminOnlyGuard, TenantContextService],
})
export class AuditReadModule {}
