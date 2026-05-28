import { Module } from "@nestjs/common";
import { MedicinesController } from "./medicines.controller";
import { MedicalConditionsController } from "./medical-conditions.controller";
import { VaccinesController } from "./vaccines.controller";
import { BodySystemsController } from "./body-systems.controller";
import { Icd10Controller } from "./icd10.controller";
import { CptController } from "./cpt.controller";

@Module({
  controllers: [
    MedicinesController,
    MedicalConditionsController,
    VaccinesController,
    BodySystemsController,
    Icd10Controller,
    CptController,
  ],
})
export class CodingModule {}
