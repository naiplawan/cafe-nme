import { ApiProperty } from "@nestjs/swagger";

export class CheckoutReceiptDto {
  @ApiProperty({ format: "uuid", description: "Committed order ID." })
  orderId!: string;

  @ApiProperty({ type: Number, description: "Shop-local daily order number." })
  dailyNo!: number;

  @ApiProperty({ type: Number, description: "Subtotal in satang." })
  subtotalSatang!: number;

  @ApiProperty({ type: Number, description: "Member reward discount in satang." })
  discountSatang!: number;

  @ApiProperty({ type: Number, description: "Amount due in satang." })
  totalSatang!: number;

  @ApiProperty({ type: Number, description: "Cash change in satang; zero for PromptPay." })
  changeSatang!: number;

  @ApiProperty({ type: Number, description: "Stamps earned by this checkout." })
  stampsEarned!: number;

  @ApiProperty({ type: Number, description: "Rewards created by this checkout." })
  rewardsCreated!: number;

  @ApiProperty({
    description: "True when the request key replayed the committed receipt; false for a newly committed checkout.",
  })
  replayed!: boolean;
}
