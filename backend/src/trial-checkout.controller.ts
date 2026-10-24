import { Body, Controller, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsUUID, ValidateNested } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { CheckoutLineDto } from "./common/request.dto.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { TrialCheckoutService } from "./trial-checkout.service.js";
class TrialCheckoutDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ enum: ["cash", "promptpay"] }) @IsIn(["cash", "promptpay"]) method!: "cash" | "promptpay";
  @ApiProperty({ type: [CheckoutLineDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CheckoutLineDto) lines!: CheckoutLineDto[];
}
class TrialCheckoutResultDto {
  @ApiProperty() totalSatang!: number;
  @ApiProperty() itemCount!: number;
  @ApiProperty({ enum: ["cash", "promptpay"] }) method!: "cash" | "promptpay";
}
@ApiStandardErrors()
@ApiTags("setup")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/setup/trial-checkout")
export class TrialCheckoutController {
  constructor(@Inject(TrialCheckoutService) private readonly service: TrialCheckoutService) {}
  @Post()
  @ApiCreatedResponse({ type: TrialCheckoutResultDto })
  run(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: TrialCheckoutDto) {
    return this.service.run(shopId, input.actorStaffId, input);
  }
}
