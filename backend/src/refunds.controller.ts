import { Body,Controller,Get,Inject,Param,ParseUUIDPipe,Post,Query,UseGuards } from "@nestjs/common";
import { ApiProperty,ApiOkResponse,ApiCreatedResponse,ApiSecurity,ApiTags } from "@nestjs/swagger";
import { IsUUID,IsString,IsInt,Min,Max,MaxLength,ArrayMinSize,ArrayMaxSize,ValidateNested,IsIn,IsBoolean,Equals } from "class-validator";
import { Type } from "class-transformer";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { RefundsService } from "./refunds.service.js";
class RefundLineInput { @ApiProperty() @IsUUID() itemId!:string; @ApiProperty() @IsInt() @Min(1) @Max(99) qty!:number; }
class RefundRequestDto {
 @ApiProperty() @IsUUID() actorStaffId!:string;
 @ApiProperty() @IsUUID() requestId!:string;
 @ApiProperty() @IsString() @MaxLength(500) reason!:string;
 @ApiProperty({type:[RefundLineInput]}) @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>RefundLineInput) lines!:RefundLineInput[];
}
class PayoutDto {
 @ApiProperty() @IsUUID() actorStaffId!:string;
 @ApiProperty({enum:["cash","promptpay"]}) @IsIn(["cash","promptpay"]) method!:"cash"|"promptpay";
 @ApiProperty() @IsString() @MaxLength(200) reference!:string;
 @ApiProperty() @IsBoolean() @Equals(true) paidInReality!:boolean;
}
class RefundResultDto { @ApiProperty() id!:string; @ApiProperty() amountSatang!:number; }
class PayoutResultDto { @ApiProperty() success!:boolean; }
class RefundLineDto extends RefundLineInput { @ApiProperty() amountSatang!:number; @ApiProperty() stampsReversed!:number; }
class RefundRecordDto extends RefundResultDto {
 @ApiProperty({type:[RefundLineDto]}) lines!:RefundLineDto[];
 @ApiProperty() reason!:string; @ApiProperty() approvedBy!:string; @ApiProperty() createdAt!:string;
 @ApiProperty({type:String,nullable:true}) paidAt!:string|null;
 @ApiProperty({type:String,nullable:true}) paidBy!:string|null;
 @ApiProperty({type:String,nullable:true}) payoutMethod!:string|null;
 @ApiProperty({type:String,nullable:true}) payoutReference!:string|null;
}
class RefundOrderDto { @ApiProperty() id!:string; @ApiProperty() dailyNo!:number; @ApiProperty() totalSatang!:number; @ApiProperty() status!:string; }
class RefundItemDto { @ApiProperty() id!:string; @ApiProperty() name!:string; @ApiProperty() qty!:number; @ApiProperty({type:Number,nullable:true}) paidSatang!:number|null; }
class RefundDetailDto { @ApiProperty({type:RefundOrderDto}) order!:RefundOrderDto; @ApiProperty({type:[RefundItemDto]}) items!:RefundItemDto[]; @ApiProperty({type:[RefundRecordDto]}) refunds!:RefundRecordDto[]; }
@ApiStandardErrors() @ApiTags("refunds") @ApiSecurity("internal-api-token") @UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId")
export class RefundsController {
 constructor(@Inject(RefundsService) private readonly service:RefundsService) {}
 @Get("orders/:orderId/refunds") @ApiOkResponse({type:RefundDetailDto})
 detail(@Param("shopId",new ParseUUIDPipe()) shop:string,@Param("orderId",new ParseUUIDPipe()) order:string,@Query("actorStaffId",new ParseUUIDPipe()) actor:string) { return this.service.detail(shop,actor,order); }
 @Post("orders/:orderId/refunds") @ApiCreatedResponse({type:RefundResultDto})
 create(@Param("shopId",new ParseUUIDPipe()) shop:string,@Param("orderId",new ParseUUIDPipe()) order:string,@Body() input:RefundRequestDto) { return this.service.create(shop,input.actorStaffId,order,input); }
 @Post("refunds/:refundId/payout") @ApiCreatedResponse({type:PayoutResultDto})
 payout(@Param("shopId",new ParseUUIDPipe()) shop:string,@Param("refundId",new ParseUUIDPipe()) refund:string,@Body() input:PayoutDto) { return this.service.payout(shop,input.actorStaffId,refund,input.method,input.reference); }
}
