import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ReconciliationService } from "./reconciliation.service.js";

class PaymentReviewDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) observedSatang!: number;
  @ApiProperty() @IsString() @MaxLength(500) note!: string;
}
class ReviewResultDto {
  @ApiProperty() id!: string;
}
class ReconciliationRowDto {
  @ApiProperty() paymentId!: string;
  @ApiProperty() dailyNo!: number;
  @ApiProperty({ enum: ["cash", "promptpay"] }) method!: string;
  @ApiProperty() expectedSatang!: number;
  @ApiProperty({ type: Number, nullable: true }) observedSatang!: number | null;
  @ApiProperty({ type: Number, nullable: true }) differenceSatang!: number | null;
  @ApiProperty({ enum: ["pending", "matched", "discrepancy"] }) status!: string;
  @ApiProperty({ type: String, nullable: true }) recordedBy!: string | null;
  @ApiProperty({ type: String, nullable: true }) reviewedBy!: string | null;
  @ApiProperty({ type: String, nullable: true }) reviewedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["staff"] }) source!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

@ApiStandardErrors()
@ApiTags("reconciliation")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/reconciliation")
export class ReconciliationController {
  constructor(@Inject(ReconciliationService) private readonly service: ReconciliationService) {}

  @Get()
  @ApiOkResponse({ type: ReconciliationRowDto, isArray: true })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("actorStaffId", new ParseUUIDPipe()) actor: string, @Query("day") day: string) {
    return this.service.list(shopId, actor, day);
  }

  @Post(":paymentId/reviews")
  @ApiCreatedResponse({ type: ReviewResultDto })
  review(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string, @Body() input: PaymentReviewDto) {
    return this.service.review(shopId, input.actorStaffId, paymentId, input);
  }
}
