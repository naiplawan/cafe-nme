import { Body, Controller, DefaultValuePipe, Get, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
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
class CashMovementDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty({ enum: ['float_topup','petty_cash','bank_deposit'] }) @IsIn(['float_topup','petty_cash','bank_deposit']) kind!: 'float_topup' | 'petty_cash' | 'bank_deposit';
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) amountSatang!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
class CashMovementResultDto { @ApiProperty() id!: string; }
class CashMovementRowDto extends CashMovementDto {
  @ApiProperty() id!: string;
  @ApiProperty() shiftId!: string;
  @ApiProperty() approvedByStaffId!: string;
  @ApiProperty() createdAt!: string;
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
class CashStatementTotalsDto {
  @ApiProperty() cashSalesSatang!: number;
  @ApiProperty() cashRefundsSatang!: number;
  @ApiProperty() topupsSatang!: number;
  @ApiProperty() pettyCashSatang!: number;
  @ApiProperty() depositsSatang!: number;
}
class CashStatementEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['sale','refund','float_topup','petty_cash','bank_deposit'] }) kind!: string;
  @ApiProperty() amountSatang!: number;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ type: String, nullable: true }) actorName!: string | null;
  @ApiProperty({ type: String, nullable: true }) approvedByName!: string | null;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, nullable: true }) reference!: string | null;
  @ApiProperty({ type: String, nullable: true }) orderId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) dailyNo!: number | null;
  @ApiProperty({ type: String, nullable: true }) businessDate!: string | null;
}
class CashStatementDto {
  @ApiProperty({ type: ShiftDto }) shift!: ShiftDto;
  @ApiProperty({ type: String, nullable: true }) closedByName!: string | null;
  @ApiProperty({ type: String, nullable: true }) handedToName!: string | null;
  @ApiProperty({ type: CashStatementTotalsDto }) totals!: CashStatementTotalsDto;
  @ApiProperty() ledgerCashSatang!: number;
  @ApiProperty({ type: Number, nullable: true }) snapshotDifferenceSatang!: number | null;
  @ApiProperty({ type: CashStatementEntryDto, isArray: true }) entries!: CashStatementEntryDto[];
  @ApiProperty() entryCount!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
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

  @Get(':shiftId/statement')
  @ApiOkResponse({ type: CashStatementDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  statement(@Param('shopId', new ParseUUIDPipe()) shop: string, @Param('shiftId', new ParseUUIDPipe()) shift: string,
    @Query('actorStaffId', new ParseUUIDPipe()) actor: string, @Query('page', new DefaultValuePipe(1), new ParseIntPipe()) page: number) {
    return this.service.statement(shop, actor, shift, page);
  }

  @Get(':shiftId/movements')
  @ApiOkResponse({ type: CashMovementRowDto, isArray: true })
  movements(@Param('shopId', new ParseUUIDPipe()) shopId: string,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string, @Query('actorStaffId', new ParseUUIDPipe()) actor: string) {
    return this.service.movements(shopId, actor, shiftId);
  }

  @Post(':shiftId/movements')
  @ApiCreatedResponse({ type: CashMovementResultDto })
  recordMovement(@Param('shopId', new ParseUUIDPipe()) shopId: string,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string, @Body() input: CashMovementDto) {
    return this.service.recordMovement(shopId, input.actorStaffId, shiftId, input);
  }

  @Post(":shiftId/close")
  @ApiCreatedResponse({ type: ShiftDto })
  close(@Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("shiftId", new ParseUUIDPipe()) shiftId: string, @Body() input: CloseShiftDto) {
    return this.service.close(shopId, input.actorStaffId, shiftId, input);
  }
}
