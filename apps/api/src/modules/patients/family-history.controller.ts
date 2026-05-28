import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FamilyHistoryService } from "./family-history.service";
import { CreateFamilyHistoryDto, type FamilyHistoryItem } from "./dto/family-history.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/family-history")
export class FamilyHistoryController {
  constructor(private readonly familyHistory: FamilyHistoryService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<FamilyHistoryItem[]> {
    return this.familyHistory.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateFamilyHistoryDto,
  ): Promise<{ pfiHereditaryDiseasesId: string }> {
    return this.familyHistory.create(patientId, body);
  }

  @Delete(":itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
  ): Promise<void> {
    await this.familyHistory.delete(patientId, itemId);
  }
}
