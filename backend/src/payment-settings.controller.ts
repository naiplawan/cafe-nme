import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, Query, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { PromptPaySettingsDto } from "./common/request.dto.js";
import { PaymentSettingsService } from "./payment-settings.service.js";
import { PaymentSettingsDto, SuccessDto } from "./core-response.dto.js";

@ApiStandardErrors()
@ApiTags("payment-settings")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/payment-settings")
@UseGuards(InternalApiGuard)
export class PaymentSettingsController {
  constructor(@Inject(PaymentSettingsService) private readonly settings: PaymentSettingsService) {}

  @Get("promptpay")
  @ApiOkResponse({ type: PaymentSettingsDto })
  getPromptPayId(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("actorStaffId", new ParseUUIDPipe()) actorStaffId: string,
  ) {
    return this.settings.getPromptPayId(shopId, actorStaffId);
  }

  @Put("promptpay")
  @ApiOkResponse({ type: SuccessDto })
  savePromptPayId(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Body() body: PromptPaySettingsDto,
  ) {
    return this.settings.savePromptPayId(shopId, body.actorStaffId, body.promptpayId);
  }
}
