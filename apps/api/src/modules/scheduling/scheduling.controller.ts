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
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { SchedulingService } from "./scheduling.service";
import {
  CreateScheduleDto,
  ListScheduleQueryDto,
  UpdateScheduleDto,
  type ScheduleListItem,
} from "./dto/schedule.dto";

class StartVisitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  visitType?: number;
}

class ChangeStatusDto {
  @IsInt()
  @Min(1)
  @Max(7)
  statusId!: number;
}

@ApiTags("schedule")
@ApiBearerAuth()
@Controller("schedule")
export class SchedulingController {
  constructor(private readonly schedule: SchedulingService) {}

  @Get()
  list(@Query() query: ListScheduleQueryDto): Promise<ScheduleListItem[]> {
    return this.schedule.list(query);
  }

  @Post()
  create(@Body() body: CreateScheduleDto): Promise<{ scheduleItemId: string }> {
    return this.schedule.create(body);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateScheduleDto,
  ): Promise<void> {
    await this.schedule.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.schedule.delete(id);
  }

  @Patch(":id/status")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ChangeStatusDto,
  ): Promise<void> {
    await this.schedule.update(id, { statusId: body.statusId });
  }

  @Post(":id/start-visit")
  startVisit(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: StartVisitDto,
  ): Promise<{ patientVisitId: string; alreadyExisted: boolean }> {
    return this.schedule.startVisit(id, { visitType: body.visitType });
  }
}
