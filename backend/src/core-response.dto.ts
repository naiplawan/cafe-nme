import { ApiProperty } from "@nestjs/swagger";

export class HealthStatusDto {
  @ApiProperty({ enum: ["ok", "ready"] }) status!: "ok" | "ready";
}

export class PublicUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
}

export class AuthTokenDto {
  @ApiProperty({ type: PublicUserDto }) user!: PublicUserDto;
  @ApiProperty() token!: string;
}

export class AuthSessionDto {
  @ApiProperty({ type: PublicUserDto, nullable: true }) user!: PublicUserDto | null;
}

export class SignedOutDto {
  @ApiProperty({ enum: ["signed_out"] }) status!: "signed_out";
}

export class RateLimitResultDto {
  @ApiProperty() allowed!: boolean;
}

export class OwnerShopExistsDto {
  @ApiProperty() exists!: boolean;
}

export class ShopCreatedDto {
  @ApiProperty({ enum: ["created"] }) status!: "created";
  @ApiProperty({ format: "uuid" }) shopId!: string;
}

export class StaffMembershipUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["owner", "manager", "barista"] }) role!: "owner" | "manager" | "barista";
}

export class StaffMembershipShopDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
}

export class StaffMembershipDto {
  @ApiProperty({ type: StaffMembershipUserDto }) staff!: StaffMembershipUserDto;
  @ApiProperty({ type: StaffMembershipShopDto }) shop!: StaffMembershipShopDto;
  @ApiProperty({ format: "uuid" }) shopId!: string;
}

export class SalesByItemDto {
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() revenueSatang!: number;
}

export class DailySalesDto {
  @ApiProperty({ format: "date" }) date!: string;
  @ApiProperty() orders!: number;
  @ApiProperty() netSatang!: number;
}

export class HourlySalesDto {
  @ApiProperty({ minimum: 0, maximum: 23 }) hour!: number;
  @ApiProperty() orders!: number;
  @ApiProperty() netSatang!: number;
}

export class CategorySalesDto {
  @ApiProperty() category!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() revenueSatang!: number;
}

export class MemberGrowthDto {
  @ApiProperty({ format: "date" }) date!: string;
  @ApiProperty() newMembers!: number;
  @ApiProperty() totalMembers!: number;
}

export class MemberOverviewDto {
  @ApiProperty() total!: number;
  @ApiProperty() lineLinked!: number;
  @ApiProperty() active30d!: number;
  @ApiProperty() rewardsAvailable!: number;
}

export class PaymentSettingsDto {
  @ApiProperty({ nullable: true }) promptpayId!: string | null;
}

export class SuccessDto {
  @ApiProperty() success!: boolean;
}
