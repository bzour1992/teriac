import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto, type AuthSession, type TokenPair } from "./dto/login.dto";
import { JwtAuthGuard, Public } from "./jwt.guard";
import { TenantContextService } from "../../common/tenant/tenant-context";

@ApiTags("auth")
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantContextService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() req: Request): Promise<AuthSession> {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.ip ?? "").trim();
    return this.auth.login(body.username, body.password, ip || "0.0.0.0");
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(body.refreshToken);
  }

  @Get("me")
  @ApiBearerAuth()
  me(): Promise<{ user: AuthSession["user"]; hcenter: AuthSession["hcenter"] }> {
    return this.auth.me(this.tenant.userId);
  }
}
