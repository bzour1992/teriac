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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LabRequestsService } from "./lab-requests.service";
import {
  CreateLabRequestDto,
  UpdateLabRequestDto,
  type LabRequestListItem,
} from "./dto/lab-request.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/lab-requests")
export class LabRequestsController {
  constructor(private readonly labRequests: LabRequestsService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<LabRequestListItem[]> {
    return this.labRequests.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateLabRequestDto,
  ): Promise<{ patientLabRequestId: string }> {
    return this.labRequests.create(patientId, body);
  }

  @Patch(":requestId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() body: UpdateLabRequestDto,
  ): Promise<void> {
    await this.labRequests.update(patientId, requestId, body);
  }

  @Delete(":requestId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ): Promise<void> {
    await this.labRequests.delete(patientId, requestId);
  }
}
