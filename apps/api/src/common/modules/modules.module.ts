import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ModulesAccessService } from "./modules-access.service";
import { ModuleEnabledGuard } from "./module-enabled.guard";
import { TenantContextService } from "../tenant/tenant-context";

/**
 * Global module exposing the modules-access service and registering the
 * @RequiresModule guard at the application level.
 */
@Global()
@Module({
  providers: [
    ModulesAccessService,
    TenantContextService,
    { provide: APP_GUARD, useClass: ModuleEnabledGuard },
  ],
  exports: [ModulesAccessService],
})
export class ModulesAccessModule {}
