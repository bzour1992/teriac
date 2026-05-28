import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { Language, UserType } from "@teriac/shared";

export interface TenantClaims {
  hcenterId: string;
  userId: string;
  userType: UserType;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  language: Language;
  permissions: ReadonlySet<string>;
}

const KEY = "tenant" as const;

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  set(claims: TenantClaims): void {
    this.cls.set(KEY, claims);
  }

  /** Returns the current tenant context. Throws if accessed outside a request scope. */
  get(): TenantClaims {
    const claims = this.cls.get<TenantClaims>(KEY);
    if (!claims) {
      throw new Error(
        "TenantContext accessed outside a request scope. Confirm TenantMiddleware ran for this route.",
      );
    }
    return claims;
  }

  /** Like `get()` but returns null instead of throwing — for routes that allow unauthenticated access. */
  tryGet(): TenantClaims | null {
    return this.cls.get<TenantClaims>(KEY) ?? null;
  }

  get hcenterId(): string {
    return this.get().hcenterId;
  }

  get userId(): string {
    return this.get().userId;
  }
}
