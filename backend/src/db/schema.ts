import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Money is always stored in satang (1 baht = 100 satang).

const id = () => uuid("id").primaryKey().defaultRandom();
const shopId = () =>
  uuid("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const staffRole = pgEnum("staff_role", ["owner", "manager", "barista"]);
export const orderStatus = pgEnum("order_status", ["open", "paid", "void"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "promptpay"]);
export const stampReason = pgEnum("stamp_reason", [
  "earn",
  "redeem",
  "expire",
  "adjust",
]);
export const rewardStatus = pgEnum("reward_status", [
  "available",
  "redeemed",
  "expired",
]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const authSessions = pgTable("auth_sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("auth_sessions_user_idx").on(t.userId), index("auth_sessions_expiry_idx").on(t.expiresAt)]);

export const shops = pgTable("shops", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Bangkok"),
  promptpayId: text("promptpay_id"),
  receiptFooter: text("receipt_footer"),
  stampGoal: integer("stamp_goal").notNull().default(10),
  stampExpiryMonths: integer("stamp_expiry_months").notNull().default(12),
  // Sold-out products become available again on the shop's next business day.
  autoClearSoldOut: boolean("auto_clear_sold_out").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [check("shops_stamp_goal_positive_check", sql`${t.stampGoal} > 0`)]);

export const staff = pgTable(
  "staff",
  {
    id: id(),
    shopId: shopId(),
    name: text("name").notNull(),
    role: staffRole("role").notNull().default("barista"),
    pinHash: text("pin_hash"),
    // App user id; only owners/managers who use /admin have one.
    authUserId: uuid("auth_user_id").references(() => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("staff_shop_idx").on(t.shopId), uniqueIndex("staff_shop_auth_user_uidx").on(t.shopId, t.authUserId)],
);

export const posDevices = pgTable("pos_devices", {
  id: id(),
  shopId: shopId(),
  name: text("name").notNull(),
  // Set once the device is paired; the raw token lives only in the device cookie.
  deviceTokenHash: text("device_token_hash").unique(),
  // One-time pairing code shown in admin, valid for a few minutes.
  pairingCodeHash: text("pairing_code_hash"),
  pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    shopId: shopId(),
    name: text("name").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("categories_shop_idx").on(t.shopId)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    shopId: shopId(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    basePriceSatang: integer("base_price_satang").notNull(),
    imageUrl: text("image_url"),
    // Tile colour shown when there is no image; null picks one from the name.
    tileColor: text("tile_color"),
    isActive: boolean("is_active").notNull().default(true),
    // Temporarily out of stock: still listed on the POS but cannot be sold. Staff toggle it.
    soldOut: boolean("sold_out").notNull().default(false),
    // Business date (YYYY-MM-DD, shop timezone) the product was marked sold out.
    soldOutOn: text("sold_out_on"),
    earnsStamp: boolean("earns_stamp").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("products_shop_idx").on(t.shopId),
    check("products_base_price_nonnegative_check", sql`${t.basePriceSatang} >= 0`),
  ],
);

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: id(),
    shopId: shopId(),
    name: text("name").notNull(),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("modifier_groups_shop_idx").on(t.shopId),
    check("modifier_groups_selection_bounds_check", sql`${t.minSelect} >= 0 and ${t.maxSelect} >= ${t.minSelect}`),
  ],
);

export const modifiers = pgTable("modifiers", {
  id: id(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDeltaSatang: integer("price_delta_satang").notNull().default(0),
  sort: integer("sort").notNull().default(0),
});

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);

export const members = pgTable(
  "members",
  {
    id: id(),
    shopId: shopId(),
    lineUserId: text("line_user_id"),
    phone: text("phone"),
    displayName: text("display_name").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("members_shop_line_uidx").on(t.shopId, t.lineUserId),
    uniqueIndex("members_shop_phone_uidx").on(t.shopId, t.phone),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    shopId: shopId(),
    // Resets every day in the shop's timezone; businessDate is that day (YYYY-MM-DD).
    dailyNo: integer("daily_no").notNull(),
    businessDate: text("business_date").notNull(),
    status: orderStatus("status").notNull().default("open"),
    memberId: uuid("member_id").references(() => members.id),
    staffId: uuid("staff_id").references(() => staff.id),
    subtotalSatang: integer("subtotal_satang").notNull().default(0),
    discountSatang: integer("discount_satang").notNull().default(0),
    totalSatang: integer("total_satang").notNull().default(0),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => staff.id),
    checkoutKey: uuid("checkout_key"),
    checkoutFingerprint: text("checkout_fingerprint"),
    checkoutResult: jsonb("checkout_result"),
  },
  (t) => [
    uniqueIndex("orders_shop_checkout_key_uidx").on(t.shopId, t.checkoutKey),
    uniqueIndex("orders_shop_day_no_uidx").on(
      t.shopId,
      t.businessDate,
      t.dailyNo,
    ),
  ],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  nameSnapshot: text("name_snapshot").notNull(),
  unitPriceSatang: integer("unit_price_satang").notNull(),
  qty: integer("qty").notNull().default(1),
  note: text("note"),
}, (t) => [
  check("order_items_qty_bounds_check", sql`${t.qty} between 1 and 99`),
  check("order_items_unit_price_nonnegative_check", sql`${t.unitPriceSatang} >= 0`),
]);

export const orderItemModifiers = pgTable("order_item_modifiers", {
  id: id(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  nameSnapshot: text("name_snapshot").notNull(),
  priceDeltaSatang: integer("price_delta_satang").notNull(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  method: paymentMethod("method").notNull(),
  amountSatang: integer("amount_satang").notNull(),
  cashReceivedSatang: integer("cash_received_satang"),
  confirmedBy: uuid("confirmed_by").references(() => staff.id),
  createdAt: createdAt(),
});

// Append-only: a member's balance is SUM(delta).
export const stampLedger = pgTable(
  "stamp_ledger",
  {
    id: id(),
    shopId: shopId(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    orderId: uuid("order_id").references(() => orders.id),
    delta: integer("delta").notNull(),
    reason: stampReason("reason").notNull(),
    staffId: uuid("staff_id").references(() => staff.id),
    createdAt: createdAt(),
  },
  (t) => [index("stamp_ledger_member_idx").on(t.memberId)],
);

export const rewards = pgTable("rewards", {
  id: id(),
  shopId: shopId(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  status: rewardStatus("status").notNull().default("available"),
  // The order whose stamps completed this card; voiding it cancels the reward if unused.
  earnedOrderId: uuid("earned_order_id").references(() => orders.id),
  redeemedOrderId: uuid("redeemed_order_id").references(() => orders.id),
  createdAt: createdAt(),
});

export const lineChannels = pgTable("line_channels", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  messagingChannelId: text("messaging_channel_id"),
  channelSecretEnc: text("channel_secret_enc"),
  accessTokenEnc: text("access_token_enc"),
  loginChannelId: text("login_channel_id"),
  liffId: text("liff_id"),
  richMenuId: text("rich_menu_id"),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// One row per shop once the owner sets a brand; no row means the default look.
export const shopBrands = pgTable("shop_brands", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  accent: text("accent"),
  logo: bytea("logo"),
  logoMime: text("logo_mime"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  shopId: shopId(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: createdAt(),
});

export const rateLimitAttempts = pgTable("rate_limit_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
}, (t) => [index("rate_limit_attempts_window_idx").on(t.windowStartedAt)]);
