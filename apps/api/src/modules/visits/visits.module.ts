import { Module } from "@nestjs/common";
import { VisitsController } from "./visits.controller";
import { VisitsService } from "./visits.service";
import { PrescriptionsController } from "./prescriptions.controller";
import { PrescriptionsService } from "./prescriptions.service";
import { DiagnosesController } from "./diagnoses.controller";
import { DiagnosesService } from "./diagnoses.service";
import { RevisitsController } from "./revisits.controller";
import { RevisitsService } from "./revisits.service";
import { RecommendationsController } from "./recommendations.controller";
import { RecommendationsService } from "./recommendations.service";
import { BodySystemReviewController } from "./body-system-review.controller";
import { BodySystemReviewService } from "./body-system-review.service";
import { PhysicalExamController } from "./physical-exam.controller";
import { PhysicalExamService } from "./physical-exam.service";
import { VitalsController } from "./vitals.controller";
import { VitalsService } from "./vitals.service";

@Module({
  controllers: [
    VisitsController,
    PrescriptionsController,
    DiagnosesController,
    RevisitsController,
    RecommendationsController,
    BodySystemReviewController,
    PhysicalExamController,
    VitalsController,
  ],
  providers: [
    VisitsService,
    PrescriptionsService,
    DiagnosesService,
    RevisitsService,
    RecommendationsService,
    BodySystemReviewService,
    PhysicalExamService,
    VitalsService,
  ],
  exports: [
    VisitsService,
    PrescriptionsService,
    DiagnosesService,
    RevisitsService,
    RecommendationsService,
    BodySystemReviewService,
    PhysicalExamService,
    VitalsService,
  ],
})
export class VisitsModule {}
