import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Allow, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateCategoryDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
}

export class ProductDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
  @ApiProperty({ type: Number }) @Allow() price!: number;
  @ApiProperty({ type: String, nullable: true }) @Allow() categoryId!: string | null;
  @ApiProperty({ type: String, nullable: true }) @Allow() imageUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, enum: ["amber", "rose", "emerald", "sky", "violet", "stone"] }) @Allow() tileColor?: string | null;
  @ApiProperty({ type: Boolean }) @Allow() earnsStamp!: boolean;
  @ApiProperty({ type: Boolean }) @Allow() isActive!: boolean;
  @ApiProperty({ type: [String] }) @Allow() modifierGroupIds!: string[];
}

export class BulkProductUpdateDto {
  @ApiProperty({ type: [String] }) @Allow() productIds!: string[];
  @ApiPropertyOptional({ type: Boolean }) @Allow() isActive?: boolean;
  @ApiPropertyOptional({ type: Boolean }) @Allow() restoreForSale?: boolean;
  @ApiPropertyOptional({ enum: ["add", "remove"] }) @Allow() modifierGroupAction?: "add" | "remove";
  @ApiPropertyOptional({ type: String }) @Allow() modifierGroupId?: string;
}

export class CategoryIdsDto {
  @ApiProperty({ type: [String] }) @Allow() categoryIds!: string[];
}

export class MenuSettingsDto {
  @ApiProperty({ type: Boolean }) @Allow() autoClearSoldOut!: boolean;
}

export class ModifierGroupDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
  @ApiProperty({ type: Number }) @Allow() minSelect!: number;
  @ApiProperty({ type: Number }) @Allow() maxSelect!: number;
}

export class ProductIdsDto {
  @ApiProperty({ type: [String] }) @Allow() productIds!: string[];
}

export class ModifierOptionDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
  @ApiProperty({ type: Number }) @Allow() priceDeltaSatang!: number;
}

export class LiffTokenDto {
  @ApiProperty({ type: String }) @Allow() idToken!: string;
}

export class LiffRegistrationDto extends LiffTokenDto {
  @ApiProperty({ type: String }) @Allow() phone!: string;
  @ApiProperty({ type: String }) @Allow() displayName!: string;
  @ApiProperty({ type: Boolean }) @Allow() consent!: boolean;
}

export class LineConfigDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() messagingChannelId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() channelSecretEnc?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() accessTokenEnc?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() loginChannelId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() liffId?: string | null;
}

export class RichMenuDto {
  @ApiProperty({ type: String }) @Allow() richMenuId!: string;
}

export class CreateMemberDto {
  @ApiProperty({ type: String }) @Allow() phone!: string;
  @ApiProperty({ type: String }) @Allow() displayName!: string;
}

export class StampAdjustmentDto {
  @ApiProperty({ type: Number }) @Allow() delta!: number;
  @ApiProperty({ type: String }) @Allow() staffId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() note?: string | null;
}

export class VoidOrderDto {
  @ApiProperty({ type: String }) @Allow() managerStaffId!: string;
}

export class CheckoutLineDto {
  @ApiProperty({ type: String }) @Allow() productId!: string;
  @ApiProperty({ type: Number }) @Allow() qty!: number;
  @ApiProperty({ type: [String] }) @Allow() modifierIds!: string[];
  @ApiPropertyOptional({ type: String }) @Allow() note?: string;
}

export class CheckoutPaymentDto {
  @ApiProperty({ enum: ["cash", "promptpay"] }) @Allow() method!: "cash" | "promptpay";
  @ApiPropertyOptional({ type: Number }) @Allow() cashReceivedSatang?: number;
}

export class CheckoutDto {
  @ApiProperty({ type: [CheckoutLineDto] }) @Allow() @ValidateNested({ each: true }) @Type(() => CheckoutLineDto) lines!: CheckoutLineDto[];
  @ApiProperty({ type: CheckoutPaymentDto }) @Allow() @ValidateNested() @Type(() => CheckoutPaymentDto) payment!: CheckoutPaymentDto;
  @ApiProperty({ type: String }) @Allow() staffId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() memberId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @Allow() redeemRewardId?: string | null;
}

export class SetupShopDto {
  @ApiProperty({ type: String }) @Allow() authUserId!: string;
  @ApiProperty({ type: String }) @Allow() shopName!: string;
  @ApiProperty({ type: String }) @Allow() slug!: string;
  @ApiProperty({ type: String }) @Allow() ownerName!: string;
  @ApiProperty({ type: String, nullable: true }) @Allow() promptpayId!: string | null;
  @ApiProperty({ type: String }) @Allow() pin!: string;
}

export class RateLimitDto {
  @ApiProperty({ type: String }) @Allow() key!: string;
  @ApiProperty({ type: Number }) @Allow() limit!: number;
  @ApiProperty({ type: Number }) @Allow() windowSeconds!: number;
  @ApiProperty({ type: String, format: "date-time" }) @Allow() now!: string;
}

export class ActorDto {
  @ApiProperty({ type: String }) @Allow() actorStaffId!: string;
}

export class PromptPaySettingsDto extends ActorDto {
  @ApiProperty({ type: String, nullable: true }) @Allow() promptpayId!: string | null;
}

export class DeviceCreateDto extends ActorDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
}

export class PairingCodeDto {
  @ApiProperty({ type: String }) @Allow() code!: string;
}

export class DeviceTokenDto {
  @ApiProperty({ type: String }) @Allow() deviceToken!: string;
}

export class StaffLoginDto extends DeviceTokenDto {
  @ApiProperty({ type: String }) @Allow() staffId!: string;
  @ApiProperty({ type: String }) @Allow() pin!: string;
}

export class StaffCreateDto extends ActorDto {
  @ApiProperty({ type: String }) @Allow() name!: string;
  @ApiProperty({ enum: ["owner", "manager", "barista"] }) @Allow() role!: "owner" | "manager" | "barista";
  @ApiProperty({ type: String }) @Allow() pin!: string;
}

export class ManagerPinDto extends ActorDto {
  @ApiProperty({ type: String }) @Allow() pin!: string;
}

export class StaffPinDto extends ActorDto {
  @ApiProperty({ type: String }) @Allow() pin!: string;
}

export class StaffActiveDto extends ActorDto {
  @ApiProperty({ type: Boolean }) @Allow() active!: boolean;
}

export class BrandAccentDto {
  @ApiProperty({ type: String }) @Allow() accent!: string;
}
