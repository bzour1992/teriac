import { Injectable, type NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClsService } from "nestjs-cls";
import type { Request, Response, NextFunction } from "express";
import { Language, UserType } from "@teriac/shared";
import type { TenantClaims } from "./tenant-context";

/**
 * First line of defense for tenant isolation (CLAUDE.md §"Multi-tenant strategy").
 *
 * In Phase 0 we don't have real JWT auth yet, so this middleware:
 *   1. If a Bearer token is present, decodes it and uses the claims. (TODO once auth module lands.)
 *   2. Otherwise falls back to DEV_DEFAULT_HCENTER_ID / DEV_DEFAULT_USER_ID from env,
 *      which is fine for local dev and refused in production by the env loader.
 *
 * Once the auth module is implemented, this middleware will be replaced by an
 * AuthGuard + this same context setter — but the contract (TenantContextService
 * is populated before any handler runs) stays the same.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly cls: ClsService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const env = this.config.get<string>("NODE_ENV", "development");
    const devHcenter = this.config.get<string>("DEV_DEFAULT_HCENTER_ID");
    const devUser = this.config.get<string>("DEV_DEFAULT_USER_ID");

    if (env !== "production" && devHcenter && devUser) {
      const claims: TenantClaims = {
        hcenterId: devHcenter,
        userId: devUser,
        userType: UserType.Admin,
        isAdmin: true,
        isSuperAdmin: false,
        language:
          (req.headers["accept-language"]?.toString().slice(0, 2) as Language) ?? Language.English,
        permissions: new Set<string>(),
      };
      this.cls.set("tenant", claims);
    }

    // Real JWT decoding will be plugged in here once AuthModule is built.
    next();
  }
}
