import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { CheckoutLineDto } from "./common/request.dto.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { SelfOrdersService, type SelfOrderInput } from "./self-orders.service.js";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
class SelfOrderSubmitDto {
  @ApiProperty() @IsUUID() clientKey!: string;
  @ApiProperty() @Matches(TOKEN_PATTERN) statusToken!: string;
  @ApiProperty({ enum: ["pickup", "table"] }) @IsIn(["pickup", "table"]) mode!: "pickup" | "table";
  @ApiProperty({ type: String, nullable: true }) @IsOptional() @IsString() @MaxLength(40) tableLabel!: string | null;
  @ApiProperty({ type: [CheckoutLineDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CheckoutLineDto) lines!: SelfOrderInput["lines"];
}
class SelfOrderTokenDto {
  @ApiProperty() @Matches(TOKEN_PATTERN) statusToken!: string;
}
class SelfOrderDecisionDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ enum: ["accepted", "rejected"] }) @IsIn(["accepted", "rejected"]) decision!: "accepted" | "rejected";
}
class SelfOrderItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: [String] }) modifiers!: string[];
  @ApiProperty() lineTotalSatang!: number;
}
class SelfOrderViewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["pending", "accepted", "rejected", "completed"] }) status!: string;
  @ApiProperty() totalSatang!: number;
  @ApiProperty({ type: Number, nullable: true }) dailyNo!: number | null;
  @ApiProperty({ enum: ["pickup", "table"] }) mode!: string;
  @ApiProperty({ type: String, nullable: true }) tableLabel!: string | null;
  @ApiProperty({ type: [SelfOrderItemDto] }) items!: SelfOrderItemDto[];
}
class AcceptedSelfOrderDto {
  @ApiProperty({ type: [CheckoutLineDto] }) lines!: SelfOrderInput["lines"];
  @ApiProperty() totalSatang!: number;
}

@ApiStandardErrors()
@ApiTags("self-orders")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/self-orders")
export class SelfOrdersController {
  constructor(@Inject(SelfOrdersService) private readonly service: SelfOrdersService) {}
  @Post()
  @ApiCreatedResponse({ type: SelfOrderViewDto })
  submit(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: SelfOrderSubmitDto) { return this.service.submit(shopId, input); }
  @Post("status")
  @ApiCreatedResponse({ type: SelfOrderViewDto })
  status(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: SelfOrderTokenDto) { return this.service.status(shopId, input.statusToken); }
  @Get()
  @ApiOkResponse({ type: SelfOrderViewDto, isArray: true })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) { return this.service.list(shopId, actor); }
  @Post(":id/decision")
  @ApiCreatedResponse({ type: SelfOrderViewDto })
  decide(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("id", new ParseUUIDPipe()) id: string, @Body() input: SelfOrderDecisionDto) {
    return this.service.decide(shopId, input.actorStaffId, id, input.decision);
  }
  @Get(":id/draft")
  @ApiOkResponse({ type: AcceptedSelfOrderDto })
  draft(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("id", new ParseUUIDPipe()) id: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) {
    return this.service.getAcceptedDraft(shopId, actor, id);
  }
}
