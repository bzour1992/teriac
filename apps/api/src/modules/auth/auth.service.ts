import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, sql } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import { hcenterusers, hcenters } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";
import { AuditService } from "../../common/audit/audit.service";
import { ModulesAccessService } from "../../common/modules/modules-access.service";
import type { AuthSession, TokenPair } from "./dto/login.dto";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

interface JwtPayload {
  sub: string; // userId
  hcid: string; // hcenterId
  ut: number; // userType
  adm: 0 | 1; // isAdmin
  sup: 0 | 1; // isSuperAdmin
  lng: string; // language
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly modulesAccess: ModulesAccessService,
  ) {}

  async login(username: string, password: string, ip: string): Promise<AuthSession> {
    const rows = await this.db
      .select({
        userId: hcenterusers.userId,
        userName: hcenterusers.userName,
        passwordHash: hcenterusers.passwordHash,
        firstName: hcenterusers.firstName,
        lastName: hcenterusers.lastName,
        userType: hcenterusers.userType,
        isAdmin: hcenterusers.isAdmin,
        isSuperAdmin: hcenterusers.isSuperAdmin,
        isActive: hcenterusers.isActive,
        preferredLanguage: hcenterusers.preferredLanguage,
        failedLoginAttempts: hcenterusers.failedLoginAttempts,
        lockedUntil: hcenterusers.lockedUntil,
        hcenterId: hcenterusers.hcenterId,
      })
      .from(hcenterusers)
      .where(eq(hcenterusers.userName, username))
      .limit(1);

    const user = rows[0];

    if (!user) {
      await this.audit.record({
        action: "LoginFailed",
        entityType: "User",
        outcome: "denied",
        errorMessage: "unknown_username",
        ipAddressOverride: ip,
        userIdOverride: "00000000-0000-0000-0000-000000000000",
        hcenterIdOverride: "00000000-0000-0000-0000-000000000000",
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      await this.recordFailure(user.userId, user.hcenterId, ip, "account_inactive");
      throw new UnauthorizedException("Account inactive");
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await this.recordFailure(user.userId, user.hcenterId, ip, "account_locked");
      throw new UnauthorizedException("Account temporarily locked");
    }

    if (!user.passwordHash) {
      // Legacy user that has not set a password yet.
      await this.recordFailure(user.userId, user.hcenterId, ip, "no_password_set");
      throw new UnauthorizedException("Password not set — contact administrator");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.handleFailedAttempt(user.userId, user.hcenterId, user.failedLoginAttempts, ip);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Success — reset counters, update last-login.
    await this.db
      .update(hcenterusers)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString().slice(0, 23).replace("T", " "),
        lastLoginIp: ip,
      })
      .where(eq(hcenterusers.userId, user.userId));

    const hcenter = (
      await this.db
        .select({ hcenterId: hcenters.hcenterId, hcenterName: hcenters.hcenterName })
        .from(hcenters)
        .where(eq(hcenters.hcenterId, user.hcenterId))
        .limit(1)
    )[0];

    const tokens = await this.mintTokens({
      sub: user.userId,
      hcid: user.hcenterId,
      ut: user.userType,
      adm: user.isAdmin ? 1 : 0,
      sup: user.isSuperAdmin ? 1 : 0,
      lng: user.preferredLanguage ?? "en",
    });

    await this.audit.record({
      action: "Login",
      entityType: "User",
      entityId: user.userId,
      outcome: "success",
      ipAddressOverride: ip,
      userIdOverride: user.userId,
      hcenterIdOverride: user.hcenterId,
    });

    const enabledModules = Array.from(await this.modulesAccess.listEnabled(user.hcenterId));

    return {
      user: {
        userId: user.userId,
        userName: user.userName ?? "",
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        userType: user.userType,
        isAdmin: !!user.isAdmin,
        isSuperAdmin: !!user.isSuperAdmin,
        language: user.preferredLanguage ?? "en",
      },
      hcenter: {
        hcenterId: hcenter?.hcenterId ?? user.hcenterId,
        hcenterName: hcenter?.hcenterName ?? "",
        enabledModules,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const secret = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    // `verifyAsync` returns the FULL decoded payload, which includes the
    // JWT-reserved `iat`/`exp` claims from the original signing. Re-signing
    // with `expiresIn` then trips jsonwebtoken's "payload already has exp"
    // guard — so project only the application claims back to mintTokens.
    const clean: JwtPayload = {
      sub: payload.sub,
      hcid: payload.hcid,
      ut: payload.ut,
      adm: payload.adm,
      sup: payload.sup,
      lng: payload.lng,
    };
    return this.mintTokens(clean);
  }

  async me(userId: string): Promise<{ user: AuthSession["user"]; hcenter: AuthSession["hcenter"] }> {
    const rows = await this.db
      .select({
        userId: hcenterusers.userId,
        userName: hcenterusers.userName,
        firstName: hcenterusers.firstName,
        lastName: hcenterusers.lastName,
        userType: hcenterusers.userType,
        isAdmin: hcenterusers.isAdmin,
        isSuperAdmin: hcenterusers.isSuperAdmin,
        preferredLanguage: hcenterusers.preferredLanguage,
        hcenterId: hcenterusers.hcenterId,
        hcenterName: hcenters.hcenterName,
      })
      .from(hcenterusers)
      .leftJoin(hcenters, eq(hcenters.hcenterId, hcenterusers.hcenterId))
      .where(eq(hcenterusers.userId, userId))
      .limit(1);
    const u = rows[0];
    if (!u) throw new UnauthorizedException("User not found");

    const enabledModules = Array.from(await this.modulesAccess.listEnabled(u.hcenterId));

    return {
      user: {
        userId: u.userId,
        userName: u.userName ?? "",
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        userType: u.userType,
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin,
        language: u.preferredLanguage ?? "en",
      },
      hcenter: {
        hcenterId: u.hcenterId,
        hcenterName: u.hcenterName ?? "",
        enabledModules,
      },
    };
  }

  private async mintTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessSecret = this.config.getOrThrow<string>("JWT_SECRET");
    const refreshSecret = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    const accessTtl = this.config.get<string>("JWT_EXPIRES_IN", "15m");
    const refreshTtl = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "30d");

    const token = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshTtl,
    });
    return { token, refreshToken, expiresIn: parseTtl(accessTtl) };
  }

  private async handleFailedAttempt(
    userId: string,
    hcenterId: string,
    currentAttempts: number,
    ip: string,
  ): Promise<void> {
    const nextAttempts = currentAttempts + 1;
    const shouldLock = nextAttempts >= LOCKOUT_THRESHOLD;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          .toISOString()
          .slice(0, 23)
          .replace("T", " ")
      : null;

    await this.db
      .update(hcenterusers)
      .set({
        failedLoginAttempts: nextAttempts,
        lockedUntil,
      })
      .where(eq(hcenterusers.userId, userId));

    await this.recordFailure(
      userId,
      hcenterId,
      ip,
      shouldLock ? `bad_password_locked_${LOCKOUT_MINUTES}m` : "bad_password",
    );
  }

  private async recordFailure(
    userId: string,
    hcenterId: string,
    ip: string,
    reason: string,
  ): Promise<void> {
    await this.audit.record({
      action: "LoginFailed",
      entityType: "User",
      entityId: userId,
      outcome: "denied",
      errorMessage: reason,
      ipAddressOverride: ip,
      userIdOverride: userId,
      hcenterIdOverride: hcenterId,
    });
  }
}

function parseTtl(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 900;
  const [, n, unit] = m;
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(n) * (mult[unit] ?? 60);
}
