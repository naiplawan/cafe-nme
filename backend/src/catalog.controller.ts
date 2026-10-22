import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { PosMenuResponseDto } from "./rest-response.dto.js";

@ApiStandardErrors()
@ApiTags("catalog")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId")
@UseGuards(InternalApiGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("pos-menu")
  @ApiOkResponse({ type: PosMenuResponseDto })
  getPosMenu(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.catalog.getPosMenu(shopId);
  }
}
