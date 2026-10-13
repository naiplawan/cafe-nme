# Module contracts (weeks 2–6)

Workers implement these exact exports so modules built in parallel fit together.
All server modules start with `import "server-only"`. Every function that touches shop
data takes `shopId` and scopes every query by it (including updates/deletes and child rows).
Money is integer satang. Times are stored UTC; business days use the shop timezone (Asia/Bangkok).

Already provided (do not rewrite):
- `@/lib/signing`: `sign(value, purpose)`, `unsign(signed, purpose) → string | null` (HMAC with APP_SECRET)
- `@/lib/logger`: `logger` (pino). Never use console.* in app code.
- `@/lib/auth`: `requireStaff()` for /admin (Supabase session).
- `@/lib/money`, `@/lib/validation/menu`, `@/db`, `@/db/schema`.

---

## POS auth — `src/lib/pin.ts`, `src/server/pos-session.ts` (worker: pos-auth)

```ts
// src/lib/pin.ts  (pure, node:crypto scrypt; PIN = 4–6 digits)
export function isValidPin(pin: string): boolean;
export async function hashPin(pin: string): Promise<string>;
export async function verifyPin(pin: string, hash: string): Promise<boolean>;

// src/server/pos-session.ts
export type PosShop = { id: string; name: string; promptpayId: string | null; stampGoal: number; receiptFooter: string | null };
export type PosDevice = { deviceId: string; deviceName: string; shop: PosShop };
export type PosSession = PosDevice & { shopId: string; staff: { id: string; name: string; role: "owner" | "manager" | "barista" } };

export async function createDevice(shopId: string, name: string): Promise<{ deviceId: string; pairingCode: string }>;
export async function regeneratePairingCode(shopId: string, deviceId: string): Promise<string>; // 6 digits, valid 10 min
export async function pairDevice(code: string): Promise<PosDevice | null>;  // sets httpOnly cookie "pos_device" (raw random token; only its sha256 is stored)
export async function getPosDevice(): Promise<PosDevice | null>;            // reads cookie, touches lastSeenAt
export async function requirePosDevice(): Promise<PosDevice>;              // redirect("/pos/pair") if none
export async function listPosStaff(shopId: string): Promise<{ id: string; name: string; role: string; hasPin: boolean }[]>;
export async function staffLogin(staffId: string, pin: string): Promise<boolean>; // staff must belong to the device's shop; sets signed cookie "pos_staff" {staffId, deviceId, exp 12h}
export async function requirePosStaff(): Promise<PosSession>;              // redirect("/pos/login") if none/expired
export async function posLogout(): Promise<void>;
export async function verifyManagerPin(shopId: string, pin: string): Promise<{ staffId: string } | null>; // active owner/manager with this PIN
```

## Catalog, pricing, orders, loyalty (worker: orders)

```ts
// src/lib/business-date.ts (pure)
export function businessDate(at: Date, timeZone?: string): string;                 // "YYYY-MM-DD", default Asia/Bangkok
export function businessDayRange(date: string, timeZone?: string): { start: Date; end: Date };

// src/lib/pricing.ts (pure, no DB)
export type PosModifier = { id: string; name: string; priceDeltaSatang: number };
export type PosModifierGroup = { id: string; name: string; minSelect: number; maxSelect: number; modifiers: PosModifier[] };
export type PosProduct = { id: string; name: string; categoryId: string | null; basePriceSatang: number; imageUrl: string | null; earnsStamp: boolean; groups: PosModifierGroup[] };
export type PosMenu = { categories: { id: string; name: string }[]; products: PosProduct[] };
export type CartLineInput = { productId: string; qty: number; modifierIds: string[]; note?: string };
export type PricedLine = { productId: string; name: string; qty: number; note: string | null; earnsStamp: boolean;
  modifiers: PosModifier[]; unitPriceSatang: number; lineTotalSatang: number };
export class PricingError extends Error { code: "unknown_product" | "bad_qty" | "bad_modifier" | "group_min" | "group_max" }
export function priceCart(lines: CartLineInput[], menu: PosMenu): { lines: PricedLine[]; subtotalSatang: number };
export function rewardDiscount(lines: PricedLine[]): number; // unit price of the cheapest earnsStamp line, 0 if none
export function stampsForLines(lines: PricedLine[]): number;  // sum of qty for earnsStamp lines

// src/server/catalog.ts
export async function getPosMenu(shopId: string): Promise<PosMenu>; // active products only, groups/modifiers sorted

// src/server/loyalty.ts
export type MemberSummary = { id: string; displayName: string; phone: string | null; lineLinked: boolean;
  stampBalance: number; stampGoal: number; availableRewards: { id: string; createdAt: Date }[] };
export async function getMemberSummary(shopId: string, memberId: string): Promise<MemberSummary | null>;
export async function adjustStamps(shopId: string, memberId: string, delta: number, staffId: string, note?: string): Promise<MemberSummary>; // reason "adjust", writes audit_log
export async function listLedger(shopId: string, memberId: string, limit?: number): Promise<{ id: string; delta: number; reason: string; orderId: string | null; createdAt: Date }[]>;

// src/server/orders.ts
export type CheckoutInput = { lines: CartLineInput[]; memberId?: string | null; redeemRewardId?: string | null;
  payment: { method: "cash"; cashReceivedSatang: number } | { method: "promptpay" } };
export type CheckoutResult = { orderId: string; dailyNo: number; subtotalSatang: number; discountSatang: number; totalSatang: number;
  changeSatang: number; stampsEarned: number; rewardsCreated: number; member: MemberSummary | null };
export class CheckoutError extends Error { code: "empty_cart" | "pricing" | "member_not_found" | "reward_unavailable" | "cash_insufficient" }
export async function checkout(session: { shopId: string; staffId: string }, input: CheckoutInput): Promise<CheckoutResult>;
//   Re-prices from DB (never trust client prices). One transaction:
//   pg_advisory_xact_lock(hashtext(shop_id || business_date)) then daily_no = max+1;
//   insert order (status "paid", paidAt now), items + modifier snapshots, payment;
//   redeem reward (must be available & belong to member) → discount = rewardDiscount, reward.status "redeemed";
//   earn stamps if member: ledger +stamps (reason "earn"), then while balance >= goal: ledger -goal (reason "redeem")
//   and insert reward {earnedOrderId}. After commit, for each reward created call
//   pushRewardUnlocked(shopId, memberId) from "@/server/line" (fire-and-forget, log errors).
export type OrderSummary = { id: string; dailyNo: number; status: "open" | "paid" | "void"; totalSatang: number;
  paymentMethod: "cash" | "promptpay" | null; memberName: string | null; staffName: string | null; itemCount: number; paidAt: Date | null };
export async function listOrdersForDay(shopId: string, date: string): Promise<OrderSummary[]>; // newest first
export type OrderDetail = OrderSummary & { subtotalSatang: number; discountSatang: number; cashReceivedSatang: number | null;
  items: { name: string; qty: number; unitPriceSatang: number; note: string | null; modifiers: { name: string; priceDeltaSatang: number }[] }[];
  voidedAt: Date | null; businessDate: string; shopName: string; receiptFooter: string | null };
export async function getOrder(shopId: string, orderId: string): Promise<OrderDetail | null>;
export async function voidOrder(shopId: string, orderId: string, managerStaffId: string): Promise<void>;
//   Only "paid" orders. One transaction: status "void", voidedAt/By; ledger compensation row (reason "adjust", orderId)
//   = -(stamps earned by order) + goal × (rewards earned by order that are still available → set "expired");
//   a reward redeemed in this order goes back to "available". Writes audit_log.
```

## Members & LINE (worker: line)

```ts
// src/lib/crypto.ts (pure; AES-256-GCM, key = sha256(APP_SECRET + ":line"))
export function encryptSecret(plain: string): string;
export function decryptSecret(enc: string): string;

// src/lib/member-token.ts (pure; uses sign/unsign purpose "member-qr"; 60 s windows)
export function createMemberToken(memberId: string, now?: Date): string;          // "CM1.<memberId>.<window>.<mac>"-style, fits a QR
export function verifyMemberToken(token: string, now?: Date): string | null;       // accepts current and previous window → memberId

// src/server/members.ts
export type MemberRow = { id: string; displayName: string; phone: string | null; lineUserId: string | null; createdAt: Date; stampBalance: number };
export async function findMemberByToken(shopId: string, token: string): Promise<string | null>;  // memberId (not deleted, same shop)
export async function findMembersByPhone(shopId: string, phoneQuery: string): Promise<MemberRow[]>; // digits only, prefix/exact match, max 10
export async function createMemberByPhone(shopId: string, phone: string, displayName: string): Promise<MemberRow>; // walk-in without LINE
export async function listMembers(shopId: string, opts?: { search?: string; limit?: number; offset?: number }): Promise<{ rows: MemberRow[]; total: number }>;
export async function deleteMemberData(shopId: string, memberId: string): Promise<void>; // PDPA: null phone/lineUserId, name "ลบข้อมูลแล้ว", set deletedAt

// src/server/line.ts
export type LineConfig = { messagingChannelId: string | null; channelSecret: string | null; accessToken: string | null;
  loginChannelId: string | null; liffId: string | null; richMenuId: string | null };
export async function getLineConfig(shopId: string): Promise<LineConfig>;
export async function saveLineConfig(shopId: string, input: Partial<Omit<LineConfig, "richMenuId">>): Promise<void>; // encrypts secret/token
export async function verifyLineIdToken(shopSlug: string, idToken: string): Promise<{ lineUserId: string; name: string; pictureUrl: string | null } | null>;
//   Calls https://api.line.me/oauth2/v2.1/verify with client_id = loginChannelId.
//   Dev mock: if process.env.LINE_DEV_MOCK === "1" && NODE_ENV !== "production" and idToken starts with "dev:", returns { lineUserId: idToken.slice(4), name: "Dev User", pictureUrl: null }.
export async function pushRewardUnlocked(shopId: string, memberId: string): Promise<void>; // no-op if member has no lineUserId or no token; logs, never throws
export async function pushText(shopId: string, lineUserId: string, text: string): Promise<void>;
export async function setupRichMenu(shopId: string, liffUrl: string): Promise<string>; // uploads public/assets/rich-menu.png, 6 areas, sets default, stores richMenuId
```

## Reports (worker: reports)

```ts
// src/server/reports.ts
export type SalesSummary = { orders: number; voided: number; grossSatang: number; discountSatang: number; netSatang: number; cups: number;
  byMethod: { cash: number; promptpay: number }; memberOrders: number; stampsIssued: number; rewardsRedeemed: number; newMembers: number };
export async function salesSummary(shopId: string, from: string, to: string): Promise<SalesSummary>; // inclusive business dates, paid orders only (voided counted separately)
export async function salesByItem(shopId: string, from: string, to: string): Promise<{ name: string; qty: number; revenueSatang: number }[]>;
export async function dailySales(shopId: string, from: string, to: string): Promise<{ date: string; orders: number; netSatang: number }[]>;
export async function ordersForExport(shopId: string, from: string, to: string): Promise<Record<string, string | number>[]>;
```
