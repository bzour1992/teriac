import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminUsersService } from "./admin-users.service";
import {
  CreateUserDto,
  SetPermissionsDto,
  UpdateUserDto,
  type AdminUserItem,
  type PermissionItem,
} from "./dto/admin.dto";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get("users")
  listUsers(): Promise<AdminUserItem[]> {
    return this.users.listUsers();
  }

  @Post("users")
  createUser(@Body() body: CreateUserDto): Promise<{ userId: string }> {
    return this.users.createUser(body);
  }

  @Put("users/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserDto,
  ): Promise<void> {
    await this.users.updateUser(id, body);
  }

  @Get("permissions")
  listPermissions(): Promise<PermissionItem[]> {
    return this.users.listPermissions();
  }

  @Get("users/:id/permissions")
  getUserPermissions(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<number[]> {
    return this.users.getUserPermissions(id);
  }

  @Put("users/:id/permissions")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setUserPermissions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: SetPermissionsDto,
  ): Promise<void> {
    await this.users.setUserPermissions(id, body);
  }
}
