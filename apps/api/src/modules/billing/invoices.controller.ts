import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { InvoicesService } from "./invoices.service";
import {
  CreateInvoiceDto,
  type BillingInvoiceListResponse,
  type InvoiceDetail,
  type InvoiceListItem,
} from "./dto/billing.dto";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing/invoices")
export class BillingInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get("daily")
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  getDaily(
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<Array<{ date: string; invoiceCount: number; totalCharged: number; totalCollected: number; outstanding: number }>> {
    return this.invoices.getDailyBilling(from, to);
  }

  @Get()
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  listAll(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<BillingInvoiceListResponse> {
    return this.invoices.listAll({
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}

@ApiTags("billing")
@ApiBearerAuth()
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  create(
    @Body() body: CreateInvoiceDto,
  ): Promise<{ patientInvoiceId: string; invoiceNumber: string }> {
    return this.invoices.create(body);
  }

  @Get(":id")
  getById(@Param("id", new ParseUUIDPipe()) id: string): Promise<InvoiceDetail> {
    return this.invoices.getById(id);
  }
}

@ApiTags("billing")
@ApiBearerAuth()
@Controller("patients/:patientId/invoices")
export class PatientsInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<InvoiceListItem[]> {
    return this.invoices.listForPatient(patientId);
  }
}
