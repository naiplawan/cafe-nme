import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { PreparationService, type PreparationStatus } from "./preparation.service.js";

class PreparationTransitionDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ enum: ["received", "preparing"] }) @IsIn(["received", "preparing"]) expected!: PreparationStatus;
  @ApiProperty({ enum: ["preparing", "ready"] }) @IsIn(["preparing", "ready"]) desired!: PreparationStatus;
}
class PreparationItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: [String] }) modifiers!: string[];
}
class PreparationUpdateDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["received", "preparing", "ready"] }) status!: PreparationStatus;
  @ApiProperty({ type: String, nullable: true }) updatedAt!: string | null;
}
class PreparationRowDto extends PreparationUpdateDto {
  @ApiProperty() dailyNo!: number;
  @ApiProperty({ type: [PreparationItemDto] }) items!: PreparationItemDto[];
}

@ApiStandardErrors()
@ApiTags("preparation")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/preparation")
export class PreparationController {
  constructor(@Inject(PreparationService) private readonly service: PreparationService) {}

  @Get()
  @ApiOkResponse({ type: PreparationRowDto, isArray: true })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) {
    return this.service.list(shopId, actor);
  }

  @Post(":orderId")
  @ApiCreatedResponse({ type: PreparationUpdateDto })
  transition(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string, @Body() input: PreparationTransitionDto) {
    return this.service.transition(shopId, input.actorStaffId, orderId, input.expected, input.desired);
  }
}
