import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { TenantFieldRulesService, type FieldRuleDto } from "./field-rules.service";

@ApiTags("field-rules")
@ApiBearerAuth()
@Controller("field-rules")
export class FieldRulesController {
  constructor(private readonly rules: TenantFieldRulesService) {}

  /**
   * Returns this clinic's field rules. Pass `?entity=patient` to scope.
   * Only rows the superadmin has explicitly created are returned — fields
   * with no row are assumed `{ visibility: "visible", requirement: "optional" }`.
   */
  @Get()
  @ApiQuery({ name: "entity", required: false })
  list(@Query("entity") entity?: string): Promise<FieldRuleDto[]> {
    return this.rules.listForCurrentClinic(entity);
  }
}
