import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsString, IsUUID, Matches } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { OmisePaymentsService, type ProviderPaymentView } from "./omise-payments.service.js";

class ActorDto { @ApiProperty() @IsUUID() actorStaffId!: string; }
class ProviderViewDto implements ProviderPaymentView {
  @ApiProperty({ type: String, nullable: true }) id!: string | null;
  @ApiProperty() configured!: boolean;
  @ApiProperty({ type: Boolean, nullable: true }) testMode!: boolean | null;
  @ApiProperty({ enum: ["not_started", "creating", "uncertain", "pending", "verified", "paid_unfulfilled", "discrepancy", "completed", "failed", "expired"] }) status!: ProviderPaymentView["status"];
  @ApiProperty({ type: Number, nullable: true }) amountSatang!: number | null;
  @ApiProperty({ type: String, nullable: true }) qrImageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) orderId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) dailyNo!: number | null;
  @ApiProperty({ type: String, nullable: true }) discrepancyCode!: string | null;
}
class WebhookDto { @ApiProperty() @IsString() @Matches(/^evnt(?:_test)?_[a-z0-9]+$/) id!: string; }
class ProviderWebhookAckDto { @ApiProperty() accepted!: true; }

@ApiStandardErrors()
@ApiTags("provider-payments")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/self-orders/:id/provider-payment")
export class OmisePaymentsController {
  constructor(@Inject(OmisePaymentsService) private readonly service: OmisePaymentsService) {}
  @Get() @ApiOkResponse({ type: ProviderViewDto })
  get(@Param("shopId", new ParseUUIDPipe()) shop: string, @Param("id", new ParseUUIDPipe()) id: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) { return this.service.get(shop, actor, id); }
  @Post() @ApiOkResponse({ type: ProviderViewDto })
  create(@Param("shopId", new ParseUUIDPipe()) shop: string, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: ActorDto) { return this.service.create(shop, body.actorStaffId, id); }
  @Post("refresh") @ApiOkResponse({ type: ProviderViewDto })
  refresh(@Param("shopId", new ParseUUIDPipe()) shop: string, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: ActorDto) { return this.service.refresh(shop, body.actorStaffId, id); }
}

// Omise sends an event identifier only; the service fetches the event and charge from Omise before acting.
@ApiTags("provider-webhooks")
@Controller("v1/provider/omise/shops/:shopId/webhook")
export class OmiseWebhookController {
  constructor(@Inject(OmisePaymentsService) private readonly service: OmisePaymentsService) {}
  @Post() @ApiOkResponse({ type: ProviderWebhookAckDto })
  receive(@Param("shopId", new ParseUUIDPipe()) shop: string, @Body() body: WebhookDto) { return this.service.webhook(shop, body.id); }
}
