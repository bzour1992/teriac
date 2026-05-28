import { Controller, Get, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { asc } from "drizzle-orm";
import { immunizationsvaccines } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";

interface VaccineListItem {
  immunizationsVaccineId: string;
  name: string;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("coding/vaccines")
export class VaccinesController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  async list(): Promise<VaccineListItem[]> {
    const rows = await this.db
      .select({
        immunizationsVaccineId: immunizationsvaccines.immunizationsVaccineId,
        name: immunizationsvaccines.immunizationsVaccineName,
      })
      .from(immunizationsvaccines)
      .orderBy(asc(immunizationsvaccines.immunizationsVaccineName));

    return rows;
  }
}
