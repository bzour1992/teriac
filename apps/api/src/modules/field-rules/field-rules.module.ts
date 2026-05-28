import { Module } from "@nestjs/common";
import { TenantFieldRulesService } from "./field-rules.service";
import { FieldRulesController } from "./field-rules.controller";

@Module({
  controllers: [FieldRulesController],
  providers: [TenantFieldRulesService],
  exports: [TenantFieldRulesService],
})
export class FieldRulesModule {}
