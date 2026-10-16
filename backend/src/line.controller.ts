import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { LineConfigDto, RichMenuDto } from "./common/request.dto.js";
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { LineService } from "./line.service.js";

@ApiStandardErrors()
@ApiTags("line")
@ApiSecurity("internal-api-token")
@Controller("v1")
@UseGuards(InternalApiGuard)
export class LineController {
  constructor(@Inject(LineService) private readonly line: LineService) {}

  @Get("shops/:shopId/line/config")
  getConfig(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.line.getConfig(shopId);
  }

  @Put("shops/:shopId/line/config")
  saveConfig(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: LineConfigDto) {
    return this.line.saveConfig(shopId, body);
  }

  @Put("shops/:shopId/line/rich-menu")
  saveRichMenu(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: RichMenuDto) {
    return this.line.saveRichMenu(shopId, body);
  }

  @Get("shops/:shopId/line/reward-member/:memberId")
  getRewardMember(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.line.getRewardMember(shopId, memberId);
  }

  @Get("line/shops/by-slug/:shopSlug/login-channel")
  getLoginChannel(@Param("shopSlug") shopSlug: string) {
    return this.line.getLoginChannel(shopSlug);
  }

  @Get("shops/:shopId/line/webhook-config")
  getWebhookConfig(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.line.getWebhookConfig(shopId);
  }
}
