import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class IdResultDto { @ApiProperty({ format: "uuid" }) id!: string; }
export class OkResultDto { @ApiProperty() ok!: boolean; }
export class SuccessResultDto { @ApiProperty() success!: boolean; }

export class MenuCategoryResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) shopId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sort!: number;
}
export class PosMenuCategoryResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
}
export class CatalogModifierResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceDeltaSatang!: number;
}
export class CatalogModifierGroupResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() minSelect!: number;
  @ApiProperty() maxSelect!: number;
  @ApiProperty({ type: [CatalogModifierResponseDto] }) modifiers!: CatalogModifierResponseDto[];
}
export class PosMenuProductResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: "uuid", nullable: true }) categoryId!: string | null;
  @ApiProperty() basePriceSatang!: number;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ nullable: true }) tileColor!: string | null;
  @ApiProperty() earnsStamp!: boolean;
  @ApiProperty() soldOut!: boolean;
  @ApiProperty({ type: [CatalogModifierGroupResponseDto] }) groups!: CatalogModifierGroupResponseDto[];
}
export class PosMenuResponseDto {
  @ApiProperty({ type: [PosMenuCategoryResponseDto] }) categories!: PosMenuCategoryResponseDto[];
  @ApiProperty({ type: [PosMenuProductResponseDto] }) products!: PosMenuProductResponseDto[];
}
export class MenuProductRowResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) shopId!: string;
  @ApiProperty({ format: "uuid", nullable: true }) categoryId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() basePriceSatang!: number;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ nullable: true }) tileColor!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() soldOut!: boolean;
  @ApiProperty() earnsStamp!: boolean;
  @ApiProperty() sort!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
export class MenuModifierGroupRowResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() minSelect!: number;
  @ApiProperty() maxSelect!: number;
  @ApiProperty({ type: [String] }) modifierNames!: string[];
}
export class MenuSettingsResponseDto { @ApiProperty() autoClearSoldOut!: boolean; }
export class MenuResponseDto {
  @ApiProperty({ type: [MenuCategoryResponseDto] }) categories!: MenuCategoryResponseDto[];
  @ApiProperty({ type: [MenuProductRowResponseDto] }) products!: MenuProductRowResponseDto[];
  @ApiProperty({ type: [MenuModifierGroupRowResponseDto] }) modifierGroups!: MenuModifierGroupRowResponseDto[];
  @ApiProperty({ type: MenuSettingsResponseDto }) settings!: MenuSettingsResponseDto;
}
export class MenuProductDetailResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) shopId!: string;
  @ApiProperty({ format: "uuid", nullable: true }) categoryId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() basePriceSatang!: number;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ nullable: true }) tileColor!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() soldOut!: boolean;
  @ApiProperty() earnsStamp!: boolean;
  @ApiProperty() sort!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: [String], format: "uuid" }) modifierGroupIds!: string[];
}
export class MenuProductMutationResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) shopId!: string;
  @ApiProperty({ format: "uuid", nullable: true }) categoryId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() basePriceSatang!: number;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ nullable: true }) tileColor!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() soldOut!: boolean;
  @ApiProperty() earnsStamp!: boolean;
  @ApiProperty() sort!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
export class ProductSoldOutResponseDto { @ApiProperty() soldOut!: boolean; }
export class StockImportResponseDto {
  @ApiProperty() added!: number;
  @ApiProperty() linkedProducts!: number;
}
export class AdminDashboardResponseDto {
  @ApiProperty() trialSetup!: boolean;
  @ApiProperty() activeProducts!: number;
  @ApiProperty() allProducts!: number;
  @ApiProperty() categoryCount!: number;
  @ApiProperty() groupCount!: number;
  @ApiProperty() modifierSetup!: number;
  @ApiProperty() ownerPinSetup!: boolean;
  @ApiProperty() deviceSetup!: boolean;
  @ApiProperty() lineSetup!: boolean;
  @ApiProperty() brandSetup!: boolean;
}
export class AdminModifierProductResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: "uuid", nullable: true }) categoryId!: string | null;
  @ApiProperty({ nullable: true }) categoryName!: string | null;
}
export class ShopProfileResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}
export class BrandResponseDto {
  @ApiProperty({ nullable: true }) accent!: string | null;
  @ApiProperty() hasCustomAccent!: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) logoUpdatedAt!: string | null;
}
export class LineConfigResponseDto {
  @ApiProperty({ nullable: true }) messagingChannelId!: string | null;
  @ApiProperty({ nullable: true }) channelSecretEnc!: string | null;
  @ApiProperty({ nullable: true }) accessTokenEnc!: string | null;
  @ApiProperty({ nullable: true }) loginChannelId!: string | null;
  @ApiProperty({ nullable: true }) liffId!: string | null;
  @ApiProperty({ nullable: true }) richMenuId!: string | null;
}
export class LineChannelResponseDto { @ApiProperty({ nullable: true }) loginChannelId!: string | null; }
export class LineMemberResponseDto { @ApiProperty({ nullable: true }) lineUserId!: string | null; }
export class LineWebhookConfigResponseDto {
  @ApiProperty({ nullable: true }) channelSecretEnc!: string | null;
  @ApiProperty({ nullable: true }) accessTokenEnc!: string | null;
  @ApiProperty({ nullable: true }) liffId!: string | null;
  @ApiProperty() shopName!: string;
}
export class LiffShopResponseDto {
  @ApiProperty({ format: "uuid" }) shopId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() stampGoal!: number;
  @ApiProperty({ nullable: true }) liffId!: string | null;
}
export class LiffRegistrationResponseDto {
  @ApiProperty({ nullable: true }) message!: string | null;
  @ApiProperty() success!: boolean;
}
export class MemberResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) lineUserId!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty() stampBalance!: number;
}
export class MemberListResponseDto {
  @ApiProperty({ type: [MemberResponseDto] }) rows!: MemberResponseDto[];
  @ApiProperty() total!: number;
}
export class ModifierOptionResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) groupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceDeltaSatang!: number;
  @ApiProperty() sort!: number;
}
export class ModifierGroupResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() minSelect!: number;
  @ApiProperty() maxSelect!: number;
  @ApiProperty() sort!: number;
  @ApiProperty({ type: [ModifierOptionResponseDto] }) modifiers!: ModifierOptionResponseDto[];
  @ApiProperty({ type: [String], format: "uuid" }) productIds!: string[];
  @ApiProperty({ type: [String] }) productNames!: string[];
}
export class MemberSummaryResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty() lineLinked!: boolean;
  @ApiProperty() stampBalance!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) nextStampExpiryAt!: string | null;
  @ApiProperty() stampGoal!: number;
  @ApiProperty({ type: () => [AvailableRewardResponseDto] }) availableRewards!: AvailableRewardResponseDto[];
}
export class AvailableRewardResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) expiresAt!: string | null;
}
export class LiffCardMemberResponseDto {
  @ApiProperty() displayName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() stampBalance!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) nextStampExpiryAt!: string | null;
  @ApiProperty() stampGoal!: number;
  @ApiProperty() availableRewards!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) nextRewardExpiryAt!: string | null;
  @ApiProperty({ type: () => [StampLedgerResponseDto] }) history!: StampLedgerResponseDto[];
}
export class LiffCardResponseDto {
  @ApiProperty() registered!: boolean;
  @ApiPropertyOptional({ format: "uuid" }) memberId?: string;
  @ApiPropertyOptional({ type: () => LiffCardMemberResponseDto }) member?: LiffCardMemberResponseDto;
}
export class LiffCardNotRegisteredResponseDto { @ApiProperty({ enum: [false] }) registered!: false; }
export class LiffCardRegisteredResponseDto {
  @ApiProperty({ enum: [true] }) registered!: true;
  @ApiProperty({ format: "uuid" }) memberId!: string;
  @ApiProperty({ type: LiffCardMemberResponseDto }) member!: LiffCardMemberResponseDto;
}
export class MemberIdResponseDto { @ApiProperty({ format: "uuid" }) id!: string; }
export class SalesSummaryMethodDto {
  @ApiProperty() cash!: number;
  @ApiProperty() promptpay!: number;
}
export class SalesSummaryResponseDto {
  @ApiProperty() orders!: number;
  @ApiProperty() voided!: number;
  @ApiProperty() grossSatang!: number;
  @ApiProperty() discountSatang!: number;
  @ApiProperty() netSatang!: number;
  @ApiProperty() cups!: number;
  @ApiProperty({ type: SalesSummaryMethodDto }) byMethod!: SalesSummaryMethodDto;
  @ApiProperty() memberOrders!: number;
  @ApiProperty() stampsIssued!: number;
  @ApiProperty() rewardsRedeemed!: number;
  @ApiProperty() newMembers!: number;
}
export class RefundSummaryResponseDto {
  @ApiProperty() approvedSatang!: number;
  @ApiProperty() approvedCount!: number;
  @ApiProperty() paidSatang!: number;
  @ApiProperty() paidCount!: number;
  @ApiProperty() unpaidApprovedSatang!: number;
  @ApiProperty() cashPaidSatang!: number;
  @ApiProperty() promptpayPaidSatang!: number;
}
export class OrdersExportResponseDto {
  @ApiProperty({ format: "date" }) date!: string;
  @ApiProperty() orderNo!: number;
  @ApiProperty() member!: string;
  @ApiProperty() paymentMethod!: string;
  @ApiProperty() grossSatang!: number;
  @ApiProperty() discountSatang!: number;
  @ApiProperty() netSatang!: number;
  @ApiProperty() cups!: number;
}
export class ActiveStaffResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["owner", "manager", "barista"] }) role!: "owner" | "manager" | "barista";
}
export class StampLedgerResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() delta!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) expiresAt!: string | null;
  @ApiProperty({ format: "uuid", nullable: true }) sourceEntryId!: string | null;
  @ApiProperty({ format: "uuid", nullable: true }) orderId!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
export class PosDeviceListResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() paired!: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) lastSeenAt!: string | null;
}
export class PosStaffResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["owner", "manager", "barista"] }) role!: string;
  @ApiProperty() hasPin!: boolean;
  @ApiProperty() isActive!: boolean;
}
export class PosLoginStaffResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["owner", "manager", "barista"] }) role!: string;
  @ApiProperty() hasPin!: boolean;
}
export class StandardGroupsResultDto {
  @ApiProperty() created!: number;
  @ApiProperty() linkedProducts!: number;
}
export class DeviceCreatedResponseDto {
  @ApiProperty({ format: "uuid" }) deviceId!: string;
  @ApiProperty() pairingCode!: string;
}
export class PairingCodeResponseDto { @ApiProperty() pairingCode!: string; }
export class DeviceShopResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) promptpayId!: string | null;
  @ApiProperty() stampGoal!: number;
  @ApiProperty({ nullable: true }) receiptFooter!: string | null;
}
export class PairedDeviceResponseDto {
  @ApiProperty({ format: "uuid" }) deviceId!: string;
  @ApiProperty() deviceName!: string;
  @ApiProperty() deviceToken!: string;
  @ApiProperty({ type: DeviceShopResponseDto }) shop!: DeviceShopResponseDto;
}
export class PosDeviceResponseDto {
  @ApiProperty({ format: "uuid" }) deviceId!: string;
  @ApiProperty() deviceName!: string;
  @ApiProperty({ type: DeviceShopResponseDto }) shop!: DeviceShopResponseDto;
}
export class StaffLoginResponseDto {
  @ApiProperty({ format: "uuid" }) staffId!: string;
  @ApiProperty({ format: "uuid" }) deviceId!: string;
  @ApiProperty({ format: "uuid" }) shopId!: string;
}
export class StaffIdResponseDto { @ApiProperty({ format: "uuid" }) staffId!: string; }
export class StaffResponseDto { @ApiProperty({ format: "uuid" }) id!: string; }
