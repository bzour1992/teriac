import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ClsService } from "nestjs-cls";
import type { Request } from "express";
import { Language, UserType } from "@teriac/shared";
import type { TenantClaims } from "../../common/tenant/tenant-context";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Combines auth verification + tenant context population. Runs inside the CLS
 * request scope (unlike a middleware) so `cls.set("tenant", ...)` works.
 *
 * In non-production: when no Bearer token is present AND
 * DEV_DEFAULT_HCENTER_ID + DEV_DEFAULT_USER_ID are set, populate the tenant
 * from those env vars — lets us hit endpoints with curl without first logging in.
 *
 * `@Public()` skips all of this for /v1/auth/login etc.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;

    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice("Bearer ".length);
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          hcid: string;
          ut: number;
          adm: 0 | 1;
          sup: 0 | 1;
          lng: string;
        }>(token, { secret: this.config.getOrThrow<string>("JWT_SECRET") });

        const claims: TenantClaims = {
          userId: payload.sub,
          hcenterId: payload.hcid,
          userType: payload.ut as UserType,
          isAdmin: payload.adm === 1,
          isSuperAdmin: payload.sup === 1,
          language: payload.lng === "ar" ? Language.Arabic : Language.English,
          permissions: new Set<string>(),
        };
        this.cls.set("tenant", claims);
        return true;
      } catch {
        throw new UnauthorizedException("Invalid token");
      }
    }

    // Dev bypass — only outside production, and only when both env vars are set.
    const env = this.config.get<string>("NODE_ENV", "development");
    const devHcenter = this.config.get<string>("DEV_DEFAULT_HCENTER_ID");
    const devUser = this.config.get<string>("DEV_DEFAULT_USER_ID");
    if (env !== "production" && devHcenter && devUser) {
      const lang = (req.headers["accept-language"]?.toString().slice(0, 2) as Language) || Language.English;
      this.cls.set("tenant", {
        userId: devUser,
        hcenterId: devHcenter,
        userType: UserType.Admin,
        isAdmin: true,
        isSuperAdmin: false,
        language: lang,
        permissions: new Set<string>(),
      } satisfies TenantClaims);
      return true;
    }

    throw new UnauthorizedException("Missing bearer token");
  }
}
