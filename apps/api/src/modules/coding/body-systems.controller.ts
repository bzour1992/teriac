import { Controller, Get, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { asc } from "drizzle-orm";
import { bodysystems } from "../../db/schema";
import { DRIZZLE, type Db } from "../../db/tokens";

interface BodySystemItem {
  bodySystemId: string;
  name: string;
  order: number;
}

@ApiTags("coding")
@ApiBearerAuth()
@Controller("coding/body-systems")
export class BodySystemsController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  async list(): Promise<BodySystemItem[]> {
    const rows = await this.db
      .select({
        bodySystemId: bodysystems.bodySystemId,
        name: bodysystems.bodySystemName,
        order: bodysystems.bodySystemOrder,
      })
      .from(bodysystems)
      .orderBy(asc(bodysystems.bodySystemOrder));

    return rows;
  }
}
