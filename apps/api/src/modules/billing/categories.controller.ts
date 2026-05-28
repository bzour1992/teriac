import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminOnlyGuard } from "../../common/auth/admin-only.guard";
import { CategoriesService } from "./categories.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateTierLabelsDto,
  type CategoriesListResponse,
  type PriceTierLabels,
} from "./dto/billing.dto";

@ApiTags("finance")
@ApiBearerAuth()
@Controller("finance/categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // Read — open to any authenticated user (pickers need this).
  @Get()
  list(): Promise<CategoriesListResponse> {
    return this.categories.list();
  }

  @Get("tier-labels")
  tierLabels(): Promise<PriceTierLabels> {
    return this.categories.getTierLabels();
  }

  // ── Writes — admin only ──────────────────────────────────────────────────

  @Post()
  @UseGuards(AdminOnlyGuard)
  create(@Body() body: CreateCategoryDto): Promise<{ transactionCategoryId: string }> {
    return this.categories.create(body);
  }

  @Patch(":id")
  @UseGuards(AdminOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<void> {
    await this.categories.update(id, body);
  }

  @Delete(":id")
  @UseGuards(AdminOnlyGuard)
  delete(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ deleted: boolean; archived: boolean; usageCount: number }> {
    return this.categories.deleteOrArchive(id);
  }

  @Put("tier-labels")
  @UseGuards(AdminOnlyGuard)
  setTierLabels(@Body() body: UpdateTierLabelsDto): Promise<PriceTierLabels> {
    return this.categories.setTierLabels(body);
  }
}
