import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TenantContextService } from "../../common/tenant/tenant-context";

/**
 * Rejects requests where the authenticated user is not a super admin.
 * Stack: JwtAuthGuard → SuperAdminGuard → handler.
 *
 * The JWT guard populates the TenantContext with `isSuperAdmin` from the
 * `sup` JWT claim. We re-check here so cross-tenant endpoints don't accidentally
 * become callable by regular clinic admins.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly tenant: TenantContextService) {}

  canActivate(_ctx: ExecutionContext): boolean {
    const claims = this.tenant.tryGet();
    if (!claims || !claims.isSuperAdmin) {
      throw new ForbiddenException("Super admin privileges required");
    }
    return true;
  }
}
