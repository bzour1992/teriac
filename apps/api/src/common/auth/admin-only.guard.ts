import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TenantContextService } from "../tenant/tenant-context";

/**
 * Allows the request through only when the authenticated user has the
 * `isAdmin` claim (tenant admin) or `isSuperAdmin` (platform admin).
 *
 * Assumes JwtAuthGuard has already populated tenant context — register it
 * AFTER AuthModule in the global guard order if used at APP_GUARD level, or
 * combine with `@UseGuards(AdminOnlyGuard)` on a per-controller basis.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private readonly tenant: TenantContextService) {}

  canActivate(_ctx: ExecutionContext): boolean {
    const claims = this.tenant.tryGet();
    if (!claims) {
      // Should never happen — JwtAuthGuard rejects unauthenticated requests
      // before we get here. Treat as 403 to be safe.
      throw new ForbiddenException("Admin access required");
    }
    if (!(claims.isAdmin || claims.isSuperAdmin)) {
      throw new ForbiddenException("Admin access required");
    }
    return true;
  }
}
