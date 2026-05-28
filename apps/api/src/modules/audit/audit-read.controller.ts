import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AdminOnlyGuard } from "../../common/auth/admin-only.guard";
import { RequiresModule } from "../../common/modules/requires-module.decorator";
import { AuditReadService } from "./audit-read.service";
import {
  ListAuditDto,
  type AuditEventDetailDto,
  type AuditListResponse,
  type AuditSummaryResponse,
} from "./dto/audit.dto";

@ApiTags("audit")
@ApiBearerAuth()
@RequiresModule("audit")
@UseGuards(AdminOnlyGuard)
@Controller("audit")
export class AuditReadController {
  constructor(private readonly audit: AuditReadService) {}

  @Get()
  list(@Query() q: ListAuditDto): Promise<AuditListResponse> {
    return this.audit.list(q);
  }

  @Get("summary")
  summary(
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<AuditSummaryResponse> {
    return this.audit.summary(from, to);
  }

  @Get("export")
  async exportCsv(@Query() q: ListAuditDto, @Res() res: Response): Promise<void> {
    const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    for await (const chunk of this.audit.exportRows(q)) {
      res.write(chunk);
    }
    res.end();
  }

  @Get(":id")
  async getOne(@Param("id", new ParseIntPipe()) id: number): Promise<AuditEventDetailDto> {
    const event = await this.audit.getOne(id);
    if (!event) throw new NotFoundException("Audit event not found");
    return event;
  }
}
