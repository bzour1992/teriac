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
import { BillingRecordsService } from "./billing-records.service";
import { CreateBillingRecordDto, type BillingRecordItem } from "./dto/billing.dto";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("visits/:visitId/billing-records")
export class BillingRecordsController {
  constructor(private readonly billingRecords: BillingRecordsService) {}

  @Get()
  list(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
  ): Promise<BillingRecordItem[]> {
    return this.billingRecords.listForVisit(visitId);
  }

  @Post()
  add(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Body() body: CreateBillingRecordDto,
  ): Promise<{ patientBillingRecordId: string }> {
    return this.billingRecords.add(visitId, body);
  }

  @Delete(":recordId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("visitId", new ParseUUIDPipe()) visitId: string,
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
  ): Promise<void> {
    await this.billingRecords.remove(visitId, recordId);
  }
}
