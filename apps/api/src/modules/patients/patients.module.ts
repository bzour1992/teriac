import { Module } from "@nestjs/common";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";
import { AllergiesController } from "./allergies.controller";
import { AllergiesService } from "./allergies.service";
import { ChronicDiseasesController } from "./chronic-diseases.controller";
import { ChronicDiseasesService } from "./chronic-diseases.service";
import { LongTermMedicationsController } from "./long-term-medications.controller";
import { LongTermMedicationsService } from "./long-term-medications.service";
import { ProblemsController } from "./problems.controller";
import { ProblemsService } from "./problems.service";
import { FamilyHistoryController } from "./family-history.controller";
import { FamilyHistoryService } from "./family-history.service";
import { ImmunizationsController } from "./immunizations.controller";
import { ImmunizationsService } from "./immunizations.service";
import { LabRequestsController } from "./lab-requests.controller";
import { LabRequestsService } from "./lab-requests.service";
import {
  ArabicInfoController,
  AdditionalInfoController,
  SubstanceUseController,
  InsuranceController,
  PatientNotesController,
} from "./patient-extensions.controller";
import { PatientExtensionsService } from "./patient-extensions.service";
import { EchoController } from "./echo.controller";
import { EchoService } from "./echo.service";
import { VisitsModule } from "../visits/visits.module";

@Module({
  imports: [VisitsModule],
  controllers: [
    PatientsController,
    AllergiesController,
    ChronicDiseasesController,
    LongTermMedicationsController,
    ProblemsController,
    FamilyHistoryController,
    ImmunizationsController,
    LabRequestsController,
    ArabicInfoController,
    AdditionalInfoController,
    SubstanceUseController,
    InsuranceController,
    PatientNotesController,
    EchoController,
  ],
  providers: [
    PatientsService,
    AllergiesService,
    ChronicDiseasesService,
    LongTermMedicationsService,
    ProblemsService,
    FamilyHistoryService,
    ImmunizationsService,
    LabRequestsService,
    PatientExtensionsService,
    EchoService,
  ],
  exports: [
    PatientsService,
    AllergiesService,
    ChronicDiseasesService,
    LongTermMedicationsService,
    ProblemsService,
    FamilyHistoryService,
    ImmunizationsService,
    LabRequestsService,
    PatientExtensionsService,
    EchoService,
  ],
})
export class PatientsModule {}
