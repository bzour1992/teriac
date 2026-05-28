import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { VisitsService } from "./visits.service";
import type { VisitDetail } from "./dto/visit-detail.dto";
import { UpdateVisitDto } from "./dto/update-visit.dto";
import { CreateVisitDto } from "./dto/create-visit.dto";
import { ListVisitsQueryDto, type VisitListResponse, type VisitStats } from "./dto/list-visits.dto";

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits")
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  list(@Query() query: ListVisitsQueryDto): Promise<VisitListResponse> {
    return this.visits.list(query);
  }

  @Get("stats")
  stats(@Query() query: ListVisitsQueryDto): Promise<VisitStats> {
    return this.visits.stats(query);
  }

  @Get("export")
  async exportCsv(@Query() query: ListVisitsQueryDto, @Res() res: Response): Promise<void> {
    const filename = `visits-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    for await (const chunk of this.visits.exportCsv(query)) {
      res.write(chunk);
    }
    res.end();
  }

  @Post()
  create(@Body() body: CreateVisitDto): Promise<{ patientVisitId: string }> {
    return this.visits.create(body);
  }

  @Get(":id")
  getById(@Param("id", new ParseUUIDPipe()) id: string): Promise<VisitDetail> {
    return this.visits.getById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateVisitDto,
  ): Promise<VisitDetail> {
    return this.visits.update(id, body);
  }
}
