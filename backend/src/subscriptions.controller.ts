import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { SubscriptionsService } from "./subscriptions.service.js";

class ManualRenewalDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() actorUserId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty({ enum: ["basic", "pro"] }) @IsIn(["basic", "pro"]) plan!: "basic" | "pro";
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) paidAmountSatang!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(366) periodDays!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) externalReceiptRef!: string;
}
class SubscriptionPaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["basic", "pro"] }) plan!: string;
  @ApiProperty() paidAmountSatang!: number;
  @ApiProperty() periodDays!: number;
  @ApiProperty() periodStartsAt!: string;
  @ApiProperty() periodEndsAt!: string;
  @ApiProperty() externalReceiptRef!: string;
  @ApiProperty() recordedByStaffId!: string;
  @ApiProperty() recordedByUserId!: string;
  @ApiProperty() createdAt!: string;
}
class SubscriptionStateDto {
  @ApiProperty({ enum: ["basic", "pro"] }) plan!: string;
  @ApiProperty({ enum: ["basic", "pro"] }) effectivePlan!: string;
  @ApiProperty({ enum: ["trial", "active", "expired"] }) status!: string;
  @ApiProperty() trialStartedAt!: string;
  @ApiProperty() trialEndsAt!: string;
  @ApiProperty({ type: String, nullable: true }) paidUntil!: string | null;
  @ApiProperty() canRecordPayment!: boolean;
  @ApiProperty({ type: String, isArray: true, enum: ["core-pos", "reports", "shifts", "refunds", "public-menu", "self-order", "inventory-write", "shared-loyalty"] }) allowedFeatures!: string[];
  @ApiProperty({ type: SubscriptionPaymentDto, isArray: true }) payments!: SubscriptionPaymentDto[];
}
class RenewalResultDto { @ApiProperty() id!: string; }

@ApiStandardErrors()
@ApiTags("subscriptions")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/subscription")
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly service: SubscriptionsService) {}

  @Get()
  @ApiOkResponse({ type: SubscriptionStateDto })
  get(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("actorStaffId", new ParseUUIDPipe()) actorStaffId: string,
    @Query("actorUserId", new ParseUUIDPipe()) actorUserId: string) {
    return this.service.get(shopId, actorStaffId, actorUserId);
  }

  @Post("manual-renewals")
  @ApiCreatedResponse({ type: RenewalResultDto })
  renew(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: ManualRenewalDto) {
    return this.service.renew(shopId, input.actorStaffId, input.actorUserId, input);
  }
}
