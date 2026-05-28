import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ModulesAccessService } from "./modules-access.service";
import { REQUIRES_MODULE_KEY } from "./requires-module.decorator";
import { TenantContextService } from "../tenant/tenant-context";

/**
 * Reads `@RequiresModule(...)` metadata from the matched handler / controller
 * and rejects the request with 403 MODULE_DISABLED when the current clinic
 * hasn't enabled that module via the superadmin portal.
 *
 * Registered globally via APP_GUARD; routes without the decorator pass through
 * untouched.
 */
@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: ModulesAccessService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRES_MODULE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required) return true;

    // The JWT auth guard should have populated tenant context already. If it
    // hasn't, the caller is unauthenticated — surface 401 rather than a
    // misleading "module disabled" 403.
    const claims = this.tenant.tryGet?.() ?? null;
    const hcenterId = claims?.hcenterId;
    if (!hcenterId) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const enabled = await this.modules.isEnabled(hcenterId, required);
    if (!enabled) {
      throw new ForbiddenException({
        code: "MODULE_DISABLED",
        moduleKey: required,
        message: `The "${required}" module is not enabled for this clinic.`,
      });
    }
    return true;
  }
}
