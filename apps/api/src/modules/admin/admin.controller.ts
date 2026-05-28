import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import {
  UpdateHCenterDto,
  UpdateSettingsDto,
  type HCenterProfile,
  type HCenterSettings,
} from "./dto/admin.dto";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("hcenter")
  getHCenter(): Promise<HCenterProfile> {
    return this.admin.getHCenter();
  }

  @Put("hcenter")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateHCenter(@Body() body: UpdateHCenterDto): Promise<void> {
    await this.admin.updateHCenter(body);
  }

  @Get("settings")
  getSettings(): Promise<HCenterSettings> {
    return this.admin.getSettings();
  }

  @Put("settings")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateSettings(@Body() body: UpdateSettingsDto): Promise<void> {
    await this.admin.updateSettings(body);
  }
}
