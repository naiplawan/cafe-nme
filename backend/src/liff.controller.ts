import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { LiffRegistrationDto, LiffTokenDto } from "./common/request.dto.js";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { LiffService } from "./liff.service.js";

@ApiStandardErrors()
@ApiTags("liff")
@ApiSecurity("internal-api-token")
@Controller("v1/liff/shops/:shopSlug")
@UseGuards(InternalApiGuard)
export class LiffController {
  constructor(@Inject(LiffService) private readonly liff: LiffService) {}

  @Get()
  getShop(@Param("shopSlug") shopSlug: string) {
    return this.liff.getShop(shopSlug);
  }

  @Post("card")
  getMyCard(@Param("shopSlug") shopSlug: string, @Body() body: LiffTokenDto) {
    return this.liff.getMyCard(shopSlug, body);
  }

  @Post("register")
  register(@Param("shopSlug") shopSlug: string, @Body() body: LiffRegistrationDto) {
    return this.liff.register(shopSlug, body);
  }

  @Post("delete")
  deleteMyData(@Param("shopSlug") shopSlug: string, @Body() body: LiffTokenDto) {
    return this.liff.deleteMyData(shopSlug, body);
  }
}
