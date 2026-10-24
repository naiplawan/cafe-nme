import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ShiftsService } from "./shifts.service.js";

class OpenShiftDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) openingFloatSatang!: number;
}
class CloseShiftDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) countedCashSatang!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() handedToStaffId?: string | null;
}
class ShiftDto {
  @ApiProperty() id!: string;
  @ApiProperty() openedBy!: string;
  @ApiProperty() openedByName!: string;
  @ApiProperty() openingFloatSatang!: number;
  @ApiProperty() openedAt!: string;
  @ApiProperty({ type: String, nullable: true }) closedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) closedBy!: string | null;
  @ApiProperty() expectedCashSatang!: number;
  @ApiProperty({ type: Number, nullable: true }) countedCashSatang!: number | null;
  @ApiProperty({ type: Number, nullable: true }) differenceSatang!: number | null;
  @ApiProperty({ type: String, nullable: true }) handedToStaffId!: string | null;
}
class ShiftRecipientDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
class ShiftStateDto {
  @ApiProperty({ type: ShiftDto, isArray: true }) shifts!: ShiftDto[];
  @ApiProperty({ type: ShiftRecipientDto, isArray: true }) recipients!: ShiftRecipientDto[];
}

@ApiStandardErrors()
@ApiTags("shifts")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/shifts")
export class ShiftsController {
  constructor(@Inject(ShiftsService) private readonly service: ShiftsService) {}

  @Get()
  @ApiOkResponse({ type: ShiftStateDto })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) {
    return this.service.list(shopId, actor);
  }

  @Post()
  @ApiCreatedResponse({ type: ShiftDto })
  open(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: OpenShiftDto) {
    return this.service.open(shopId, input.actorStaffId, input);
  }

  @Post(":shiftId/close")
  @ApiCreatedResponse({ type: ShiftDto })
  close(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("shiftId", new ParseUUIDPipe()) shiftId: string, @Body() input: CloseShiftDto) {
    return this.service.close(shopId, input.actorStaffId, shiftId, input);
  }
}
