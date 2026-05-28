import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequiresModule } from "../../common/modules/requires-module.decorator";
import { ReportsService } from "./reports.service";
import { renderVisitReport } from "./templates/visit.template";
import { renderPrescription } from "./templates/prescription.template";
import { renderPatientSummary } from "./templates/patient-summary.template";
import { renderInvoice } from "./templates/invoice.template";
import type { Lang } from "./templates/base.template";

function parseLang(lang?: string): Lang {
  return lang === "ar" ? "ar" : "en";
}

@ApiTags("reports")
@ApiBearerAuth()
@RequiresModule("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("visit/:id")
  @ApiQuery({ name: "lang", required: false, enum: ["en", "ar"] })
  async visitReport(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("lang") lang: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.reports.getVisitReportData(id);
    const html = renderVisitReport(data, parseLang(lang));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Report-Type", "visit");
    res.send(html);
  }

  @Get("prescription/:id")
  @ApiQuery({ name: "lang", required: false, enum: ["en", "ar"] })
  async prescriptionReport(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("lang") lang: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.reports.getPrescriptionData(id);
    const html = renderPrescription(data, parseLang(lang));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Report-Type", "prescription");
    res.send(html);
  }

  @Get("patient-summary/:id")
  @ApiQuery({ name: "lang", required: false, enum: ["en", "ar"] })
  async patientSummaryReport(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("lang") lang: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.reports.getPatientSummaryData(id);
    const html = renderPatientSummary(data, parseLang(lang));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Report-Type", "patient-summary");
    res.send(html);
  }

  @Get("invoice/:id")
  @ApiQuery({ name: "lang", required: false, enum: ["en", "ar"] })
  async invoiceReport(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("lang") lang: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.reports.getInvoiceData(id);
    const html = renderInvoice(data, parseLang(lang));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Report-Type", "invoice");
    res.send(html);
  }
}
