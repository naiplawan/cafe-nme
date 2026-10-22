import { ApiProperty } from '@nestjs/swagger';

export class OrderSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() dailyNo!: number;
  @ApiProperty({ enum: ['open', 'paid', 'void'] }) status!: 'open' | 'paid' | 'void';
  @ApiProperty() totalSatang!: number;
  @ApiProperty({ enum: ['cash', 'promptpay'], nullable: true }) paymentMethod!: 'cash' | 'promptpay' | null;
  @ApiProperty({ nullable: true }) memberName!: string | null;
  @ApiProperty({ nullable: true }) staffName!: string | null;
  @ApiProperty() itemCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) paidAt!: string | null;
}

export class OrderItemModifierDto {
  @ApiProperty() name!: string;
  @ApiProperty() priceDeltaSatang!: number;
}

export class OrderItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() unitPriceSatang!: number;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ type: [OrderItemModifierDto] }) modifiers!: OrderItemModifierDto[];
}

export class OrderDetailDto extends OrderSummaryDto {
  @ApiProperty() subtotalSatang!: number;
  @ApiProperty() discountSatang!: number;
  @ApiProperty({ nullable: true }) cashReceivedSatang!: number | null;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) voidedAt!: string | null;
  @ApiProperty({ format: 'date' }) businessDate!: string;
  @ApiProperty() shopName!: string;
  @ApiProperty({ nullable: true }) receiptFooter!: string | null;
}

export class ReceiptRecipientDto {
  @ApiProperty() dailyNo!: number;
  @ApiProperty() hasMember!: boolean;
  @ApiProperty({ nullable: true }) lineUserId!: string | null;
}

export class PromptPayIdDto {
  @ApiProperty({ nullable: true }) promptpayId!: string | null;
}

export class OrderVoidResultDto {
  @ApiProperty() ok!: boolean;
}

export class CheckoutQuoteLineDto {
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() lineTotalSatang!: number;
  @ApiProperty() modifiersText!: string;
}
export class CheckoutQuoteDto {
  @ApiProperty({ type: [CheckoutQuoteLineDto] }) lines!: CheckoutQuoteLineDto[];
  @ApiProperty() subtotalSatang!: number;
  @ApiProperty() discountSatang!: number;
  @ApiProperty() totalSatang!: number;
}
