import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiCreatedResponse, ApiExtraModels, ApiOkResponse, ApiSecurity, ApiTags, getSchemaPath } from "@nestjs/swagger";
import { LiffRegistrationDto, LiffTokenDto } from "./common/request.dto.js";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { LiffService } from "./liff.service.js";
import { LiffCardNotRegisteredResponseDto, LiffCardRegisteredResponseDto, LiffRegistrationResponseDto, LiffShopResponseDto } from "./rest-response.dto.js";

@ApiStandardErrors()
@ApiTags("liff")
@ApiExtraModels(LiffCardNotRegisteredResponseDto, LiffCardRegisteredResponseDto)
@ApiSecurity("internal-api-token")
@Controller("v1/liff/shops/:shopSlug")
@UseGuards(InternalApiGuard)
export class LiffController {
  constructor(@Inject(LiffService) private readonly liff: LiffService) {}

  @Get()
  @ApiOkResponse({ type: LiffShopResponseDto, nullable: true })
  getShop(@Param("shopSlug") shopSlug: string) {
    return this.liff.getShop(shopSlug);
  }

  @Post("card")
  @ApiCreatedResponse({ schema: { oneOf: [
    { $ref: getSchemaPath(LiffCardNotRegisteredResponseDto) },
    { $ref: getSchemaPath(LiffCardRegisteredResponseDto) },
  ] } })
  getMyCard(@Param("shopSlug") shopSlug: string, @Body() body: LiffTokenDto) {
    return this.liff.getMyCard(shopSlug, body);
  }

  @Post("register")
  @ApiCreatedResponse({ type: LiffRegistrationResponseDto })
  register(@Param("shopSlug") shopSlug: string, @Body() body: LiffRegistrationDto) {
    return this.liff.register(shopSlug, body);
  }

  @Post("delete")
  @ApiCreatedResponse({ type: LiffRegistrationResponseDto })
  deleteMyData(@Param("shopSlug") shopSlug: string, @Body() body: LiffTokenDto) {
    return this.liff.deleteMyData(shopSlug, body);
  }
}
