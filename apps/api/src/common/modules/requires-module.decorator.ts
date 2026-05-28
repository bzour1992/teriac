import { SetMetadata } from "@nestjs/common";
import type { ToggleableModuleKey } from "./modules-access.service";

export const REQUIRES_MODULE_KEY = "requires_module";

/**
 * Mark a controller class or handler method as requiring a specific module to
 * be enabled for the current clinic. Enforced by `ModuleEnabledGuard`.
 *
 * Example:
 *   @RequiresModule("finance")
 *   @Controller("finance")
 *   export class FinanceController {}
 */
export const RequiresModule = (moduleKey: ToggleableModuleKey): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_MODULE_KEY, moduleKey);
