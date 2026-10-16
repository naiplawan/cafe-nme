import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { AdminDataService } from "./admin-data.service.js";

@ApiStandardErrors()
@ApiTags("admin-data")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/admin-data")
@UseGuards(InternalApiGuard)
export class AdminDataController {
  constructor(@Inject(AdminDataService) private readonly adminData: AdminDataService) {}

  @Get("dashboard")
  dashboard(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.adminData.dashboard(shopId);
  }

  @Get("modifier-products")
  modifierProducts(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.adminData.modifierProducts(shopId);
  }

  @Get("profile")
  shopProfile(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.adminData.shopProfile(shopId);
  }
}
