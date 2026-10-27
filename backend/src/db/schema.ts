import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Money is always stored in satang (1 baht = 100 satang).

const id = () => uuid('id').primaryKey().defaultRandom();
const shopId = () =>
  uuid('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const staffRole = pgEnum('staff_role', ['owner', 'manager', 'barista']);
export const orderStatus = pgEnum('order_status', ['open', 'paid', 'void']);
export const paymentMethod = pgEnum('payment_method', ['cash', 'promptpay']);
export const stampReason = pgEnum('stamp_reason', ['earn', 'redeem', 'expire', 'adjust']);
export const rewardStatus = pgEnum('reward_status', ['available', 'redeemed', 'expired']);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId), index('auth_sessions_expiry_idx').on(t.expiresAt)],
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('password_reset_tokens_user_idx').on(t.userId)]);

export const shops = pgTable(
  'shops',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    timezone: text('timezone').notNull().default('Asia/Bangkok'),
    promptpayId: text('promptpay_id'),
    receiptFooter: text('receipt_footer'),
    stampGoal: integer('stamp_goal').notNull().default(10),
    stampExpiryMonths: integer('stamp_expiry_months').notNull().default(12),
    // Sold-out products become available again on the shop's next business day.
    stockConsumption: text('stock_consumption').notNull().default('payment'),
    autoClearSoldOut: boolean('auto_clear_sold_out').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [check('shops_stock_consumption_check', sql`${t.stockConsumption} in ('payment','preparation')`), check('shops_stamp_goal_positive_check', sql`${t.stampGoal} > 0`)],
);

export const staff = pgTable(
  'staff',
  {
    id: id(),
    shopId: shopId(),
    name: text('name').notNull(),
    role: staffRole('role').notNull().default('barista'),
    pinHash: text('pin_hash'),
    // App user id; only owners/managers who use /admin have one.
    authUserId: uuid('auth_user_id').references(() => users.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('staff_shop_idx').on(t.shopId), uniqueIndex('staff_shop_auth_user_uidx').on(t.shopId, t.authUserId)],
);

export const posDevices = pgTable('pos_devices', {
  id: id(),
  shopId: shopId(),
  name: text('name').notNull(),
  // Set once the device is paired; the raw token lives only in the device cookie.
  deviceTokenHash: text('device_token_hash').unique(),
  // One-time pairing code shown in admin, valid for a few minutes.
  pairingCodeHash: text('pairing_code_hash'),
  pairingExpiresAt: timestamp('pairing_expires_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const categories = pgTable(
  'categories',
  {
    id: id(),
    shopId: shopId(),
    name: text('name').notNull(),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('categories_shop_idx').on(t.shopId)],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    shopId: shopId(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    basePriceSatang: integer('base_price_satang').notNull(),
    imageUrl: text('image_url'),
    // Tile colour shown when there is no image; null picks one from the name.
    tileColor: text('tile_color'),
    isActive: boolean('is_active').notNull().default(true),
    // Temporarily out of stock: still listed on the POS but cannot be sold. Staff toggle it.
    soldOut: boolean('sold_out').notNull().default(false),
    // Business date (YYYY-MM-DD, shop timezone) the product was marked sold out.
    soldOutOn: text('sold_out_on'),
    earnsStamp: boolean('earns_stamp').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('products_shop_idx').on(t.shopId),
    check('products_base_price_nonnegative_check', sql`${t.basePriceSatang} >= 0`),
  ],
);

export const modifierGroups = pgTable(
  'modifier_groups',
  {
    id: id(),
    shopId: shopId(),
    name: text('name').notNull(),
    minSelect: integer('min_select').notNull().default(0),
    maxSelect: integer('max_select').notNull().default(1),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [
    index('modifier_groups_shop_idx').on(t.shopId),
    check('modifier_groups_selection_bounds_check', sql`${t.minSelect} >= 0 and ${t.maxSelect} >= ${t.minSelect}`),
  ],
);

export const modifiers = pgTable('modifiers', {
  id: id(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceDeltaSatang: integer('price_delta_satang').notNull().default(0),
  sort: integer('sort').notNull().default(0),
});

export const productModifierGroups = pgTable(
  'product_modifier_groups',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => modifierGroups.id, { onDelete: 'cascade' }),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);

export const members = pgTable(
  'members',
  {
    id: id(),
    shopId: shopId(),
    lineUserId: text('line_user_id'),
    phone: text('phone'),
    displayName: text('display_name').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('members_shop_line_uidx').on(t.shopId, t.lineUserId),
    uniqueIndex('members_shop_phone_uidx').on(t.shopId, t.phone),
  ],
);

export const shifts = pgTable('shifts', {
  id: id(),
  shopId: shopId(),
  openedBy: uuid('opened_by').notNull().references(() => staff.id),
  openingRequestId: uuid('opening_request_id').notNull(),
  openingFloatSatang: integer('opening_float_satang').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => staff.id),
  closeRequestId: uuid('close_request_id'),
  expectedCashSatang: bigint('expected_cash_satang', { mode: 'number' }),
  countedCashSatang: integer('counted_cash_satang'),
  handedToStaffId: uuid('handed_to_staff_id').references(() => staff.id),
}, (t) => [
  uniqueIndex('shifts_shop_open_uidx').on(t.shopId).where(sql`${t.closedAt} is null`),
  uniqueIndex('shifts_shop_open_request_uidx').on(t.shopId, t.openingRequestId),
  uniqueIndex('shifts_shop_close_request_uidx').on(t.shopId, t.closeRequestId),
  check('shifts_float_nonnegative_check', sql`${t.openingFloatSatang} >= 0`),
  check('shifts_count_nonnegative_check', sql`${t.countedCashSatang} is null or ${t.countedCashSatang} >= 0`),
  check('shifts_closed_fields_check', sql`(${t.closedAt} is null and ${t.closedBy} is null and ${t.closeRequestId} is null and ${t.expectedCashSatang} is null and ${t.countedCashSatang} is null and ${t.handedToStaffId} is null) or (${t.closedAt} is not null and ${t.closedBy} is not null and ${t.closeRequestId} is not null and ${t.expectedCashSatang} is not null and ${t.countedCashSatang} is not null)`),
]);

export const cashMovements = pgTable('cash_movements', {
  id: id(),
  shopId: shopId(),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  kind: text('kind').notNull(),
  amountSatang: integer('amount_satang').notNull(),
  reason: text('reason').notNull(),
  actorStaffId: uuid('actor_staff_id').notNull().references(() => staff.id),
  approvedByStaffId: uuid('approved_by_staff_id').notNull().references(() => staff.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('cash_movements_request_uidx').on(t.shopId, t.requestId),
  index('cash_movements_shift_idx').on(t.shiftId),
  check('cash_movements_kind_check', sql`${t.kind} in ('float_topup','petty_cash','bank_deposit')`),
  check('cash_movements_amount_check', sql`${t.amountSatang} > 0`),
  check('cash_movements_reason_check', sql`length(trim(${t.reason})) between 1 and 500`),
]);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    shopId: shopId(),
    shiftId: uuid('shift_id').references(() => shifts.id),
    stockConsumption: text('stock_consumption'),
    recipeSnapshotAt: timestamp('recipe_snapshot_at', { withTimezone: true }),
    inventoryDeductedAt: timestamp('inventory_deducted_at', { withTimezone: true }),
    // Resets every day in the shop's timezone; businessDate is that day (YYYY-MM-DD).
    dailyNo: integer('daily_no').notNull(),
    businessDate: text('business_date').notNull(),
    status: orderStatus('status').notNull().default('open'),
    prepStatus: text('prep_status').notNull().default('received'),
    prepUpdatedAt: timestamp('prep_updated_at', { withTimezone: true }),
    memberId: uuid('member_id').references(() => members.id),
    staffId: uuid('staff_id').references(() => staff.id),
    subtotalSatang: integer('subtotal_satang').notNull().default(0),
    discountSatang: integer('discount_satang').notNull().default(0),
    totalSatang: integer('total_satang').notNull().default(0),
    createdAt: createdAt(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => staff.id),
    checkoutKey: uuid('checkout_key'),
    checkoutFingerprint: text('checkout_fingerprint'),
    checkoutResult: jsonb('checkout_result'),
  },
  (t) => [
    uniqueIndex('orders_shop_checkout_key_uidx').on(t.shopId, t.checkoutKey),
    uniqueIndex('orders_shop_day_no_uidx').on(t.shopId, t.businessDate, t.dailyNo),
  ],
);

export const selfOrders = pgTable('self_orders', {
  id: id(),
  shopId: shopId(),
  clientKey: uuid('client_key').notNull(),
  tokenHash: text('token_hash').notNull(),
  fingerprint: text('fingerprint').notNull(),
  status: text('status').notNull().default('pending'),
  mode: text('mode').notNull(),
  tableLabel: text('table_label'),
  lines: jsonb('lines').notNull(),
  items: jsonb('items').notNull(),
  totalSatang: integer('total_satang').notNull(),
  decidedBy: uuid('decided_by').references(() => staff.id),
  orderId: uuid('order_id').references(() => orders.id),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('self_orders_shop_key_uidx').on(t.shopId, t.clientKey),
  uniqueIndex('self_orders_shop_token_uidx').on(t.shopId, t.tokenHash),
  uniqueIndex('self_orders_order_uidx').on(t.orderId),
  index('self_orders_shop_status_created_idx').on(t.shopId, t.status, t.createdAt),
  check('self_orders_status_check', sql`${t.status} in ('pending','accepted','rejected','completed')`),
  check('self_orders_mode_check', sql`${t.mode} in ('pickup','table')`),
  check('self_orders_total_check', sql`${t.totalSatang} >= 0`),
  check('self_orders_completion_check', sql`(${t.status} = 'completed') = (${t.orderId} is not null)`),
]);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    nameSnapshot: text('name_snapshot').notNull(),
    unitPriceSatang: integer('unit_price_satang').notNull(),
    qty: integer('qty').notNull().default(1),
    lineNo: integer('line_no').notNull().default(0),
    paidSatang: integer('paid_satang'),
    stampsEarned: integer('stamps_earned'),
    rewardDiscountSatang: integer('reward_discount_satang'),
    costSatang: bigint('cost_satang', { mode: 'number' }),
    unitCostSatang: numeric('unit_cost_satang', { precision: 30, scale: 12 }),
    preparedQty: integer('prepared_qty'),
    note: text('note'),
  },
  (t) => [
    check('order_items_qty_bounds_check', sql`${t.qty} between 1 and 99`),
    check('order_items_unit_price_nonnegative_check', sql`${t.unitPriceSatang} >= 0`),
  ],
);

export const orderItemModifiers = pgTable('order_item_modifiers', {
  id: id(),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  nameSnapshot: text('name_snapshot').notNull(),
  priceDeltaSatang: integer('price_delta_satang').notNull(),
});

export const payments = pgTable('payments', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  method: paymentMethod('method').notNull(),
  amountSatang: integer('amount_satang').notNull(),
  cashReceivedSatang: integer('cash_received_satang'),
  confirmedBy: uuid('confirmed_by').references(() => staff.id),
  createdAt: createdAt(),
});

// A cashier's payment record is separate from a later manual receipt check.
export const paymentReviews = pgTable('payment_reviews', {
  id: id(),
  shopId: shopId(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  observedSatang: integer('observed_satang').notNull(),
  reviewedBy: uuid('reviewed_by').notNull().references(() => staff.id),
  note: text('note').notNull().default(''),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('payment_reviews_shop_request_uidx').on(t.shopId, t.requestId),
  index('payment_reviews_payment_idx').on(t.paymentId, t.createdAt),
  check('payment_reviews_observed_nonnegative_check', sql`${t.observedSatang} >= 0`),
]);

export const refunds = pgTable('refunds', {
  id: id(),
  shopId: shopId(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  amountSatang: integer('amount_satang').notNull(),
  lines: jsonb('lines').notNull(),
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by').notNull().references(() => staff.id),
  paidBy: uuid('paid_by').references(() => staff.id),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  payoutMethod: paymentMethod('payout_method'),
  payoutReference: text('payout_reference'),
  cashShiftId: uuid('cash_shift_id').references(() => shifts.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('refunds_shop_request_uidx').on(t.shopId, t.requestId),
  check('refunds_amount_nonnegative_check', sql`${t.amountSatang} >= 0`),
  check('refunds_reason_check', sql`length(trim(${t.reason})) > 0`),
]);

// Append-only: a member's balance is SUM(delta).
export const stampLedger = pgTable(
  'stamp_ledger',
  {
    id: id(),
    shopId: shopId(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    orderId: uuid('order_id').references(() => orders.id),
    delta: integer('delta').notNull(),
    reason: stampReason('reason').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sourceEntryId: uuid('source_entry_id'),
    staffId: uuid('staff_id').references(() => staff.id),
    createdAt: createdAt(),
  },
  (t) => [index('stamp_ledger_member_idx').on(t.memberId),
    uniqueIndex('stamp_ledger_expire_source_uidx').on(t.sourceEntryId).where(sql`${t.reason} = 'expire'`),
  ],
);

export const rewards = pgTable('rewards', {
  id: id(),
  shopId: shopId(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  status: rewardStatus('status').notNull().default('available'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  // The order whose stamps completed this card; voiding it cancels the reward if unused.
  earnedOrderId: uuid('earned_order_id').references(() => orders.id),
  redeemedOrderId: uuid('redeemed_order_id').references(() => orders.id),
  createdAt: createdAt(),
});

export const lineChannels = pgTable('line_channels', {
  shopId: uuid('shop_id')
    .primaryKey()
    .references(() => shops.id, { onDelete: 'cascade' }),
  messagingChannelId: text('messaging_channel_id'),
  channelSecretEnc: text('channel_secret_enc'),
  accessTokenEnc: text('access_token_enc'),
  loginChannelId: text('login_channel_id'),
  liffId: text('liff_id'),
  richMenuId: text('rich_menu_id'),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

// One row per shop once the owner sets a brand; no row means the default look.
export const shopBrands = pgTable('shop_brands', {
  shopId: uuid('shop_id')
    .primaryKey()
    .references(() => shops.id, { onDelete: 'cascade' }),
  accent: text('accent'),
  logo: bytea('logo'),
  logoMime: text('logo_mime'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: id(),
  shopId: shopId(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  payload: jsonb('payload'),
  createdAt: createdAt(),
});

export const rateLimitAttempts = pgTable(
  'rate_limit_attempts',
  {
    key: text('key').primaryKey(),
    attempts: integer('attempts').notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('rate_limit_attempts_window_idx').on(t.windowStartedAt)],
);

export const ingredients = pgTable('ingredients', {
  id: id(),
  shopId: shopId(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  lowStockMilliunits: integer('low_stock_milliunits').notNull().default(0),
  averageCostPerMilliunit: numeric('average_cost_per_milliunit', { precision: 30, scale: 12 }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('ingredients_shop_name_uidx').on(t.shopId, t.name),
  check('ingredients_unit_check', sql`${t.unit} in ('g','ml','unit')`),
  check('ingredients_low_stock_check', sql`${t.lowStockMilliunits} >= 0`),
]);

export const recipeLines = pgTable('recipe_lines', {
  shopId: shopId(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  quantityMilliunits: integer('quantity_milliunits').notNull(),
}, (t) => [
  primaryKey({ columns: [t.productId, t.ingredientId] }),
  check('recipe_lines_quantity_check', sql`${t.quantityMilliunits} > 0`),
]);

// Migration 0038 defers the replacement-ingredient FK to allow whole-shop cascades.
// Preserve DEFERRABLE INITIALLY DEFERRED if a future migration recreates that FK.
export const modifierRecipeLines = pgTable('modifier_recipe_lines', {
  shopId: shopId(),
  modifierId: uuid('modifier_id').notNull().references(() => modifiers.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  replacesIngredientId: uuid('replaces_ingredient_id').references(() => ingredients.id),
  quantityMilliunits: integer('quantity_milliunits').notNull(),
}, (t) => [
  primaryKey({ columns: [t.modifierId, t.ingredientId] }),
  check('modifier_recipe_lines_quantity_check', sql`${t.quantityMilliunits} > 0`),
]);

// Ingredient FKs on snapshots and holds are NO ACTION, DEFERRABLE INITIALLY
// DEFERRED (0038): direct ingredient deletion must not erase sale history/holds.
// Drizzle cannot encode deferrability; preserve it when recreating these FKs.
export const orderItemRecipes = pgTable('order_item_recipes', {
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id),
  unitCostSatang: numeric('unit_cost_satang', { precision: 30, scale: 12 }),
  quantityMilliunits: integer('quantity_milliunits').notNull(),
}, (t) => [primaryKey({ columns: [t.orderItemId, t.ingredientId] }),
  check('order_item_recipes_quantity_check', sql`${t.quantityMilliunits} > 0`)]);

export const orderStockHolds = pgTable('order_stock_holds', {
  shopId: shopId(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id),
  quantityMilliunits: bigint('quantity_milliunits', { mode: 'number' }).notNull(),
}, (t) => [primaryKey({ columns: [t.orderId, t.ingredientId] }),
  index('order_stock_holds_ingredient_idx').on(t.shopId, t.ingredientId),
  check('order_stock_holds_quantity_check', sql`${t.quantityMilliunits} > 0`)]);

export const remakes = pgTable('remakes', {
  id: id(), shopId: shopId(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  qty: integer('qty').notNull(),
  reason: text('reason').notNull(),
  actorStaffId: uuid('actor_staff_id').notNull().references(() => staff.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('remakes_request_uidx').on(t.shopId, t.requestId),
  check('remakes_qty_check', sql`${t.qty} between 1 and 99`),
  check('remakes_reason_check', sql`length(trim(${t.reason})) between 1 and 500`)]);

export const inventoryMovements = pgTable('inventory_movements', {
  id: id(),
  shopId: shopId(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  quantityMilliunits: bigint('quantity_milliunits', { mode: 'number' }).notNull(),
  actorStaffId: uuid('actor_staff_id').references(() => staff.id),
  reason: text('reason').notNull(),
  requestId: uuid('request_id'),
  orderId: uuid('order_id').references(() => orders.id),
  remakeId: uuid('remake_id').references(() => remakes.id),
  costSatang: bigint('cost_satang', { mode: 'number' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('inventory_movements_request_uidx').on(t.shopId, t.requestId),
  uniqueIndex('inventory_movements_sale_uidx').on(t.orderId, t.ingredientId).where(sql`${t.kind} = 'sale'`),
  index('inventory_movements_ingredient_idx').on(t.ingredientId, t.createdAt),
  check('inventory_movements_kind_check', sql`${t.kind} in ('receive','waste','adjust','sale','remake')`),
  check('inventory_movements_quantity_check', sql`${t.quantityMilliunits} <> 0 and abs(${t.quantityMilliunits}) <= 9007199254740991`),
  check('inventory_movements_reason_check', sql`length(trim(${t.reason})) between 1 and 500`),
  check('inventory_movements_source_check', sql`(${t.kind} = 'sale' and ${t.orderId} is not null and ${t.requestId} is null and ${t.quantityMilliunits} < 0) or (${t.kind} = 'remake' and ${t.remakeId} is not null and ${t.orderId} is not null and ${t.requestId} is null and ${t.actorStaffId} is not null and ${t.quantityMilliunits} < 0) or (${t.kind} not in ('sale','remake') and ${t.orderId} is null and ${t.requestId} is not null and ${t.actorStaffId} is not null)`),
  check('inventory_movements_direction_check', sql`(${t.kind} <> 'receive' or ${t.quantityMilliunits} > 0) and (${t.kind} <> 'waste' or ${t.quantityMilliunits} < 0)`),
]);

export const promptpayStockHolds = pgTable('promptpay_stock_holds', {
  shopId: shopId(),
  requestId: uuid('request_id').notNull(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.shopId, t.requestId] }),
  index('promptpay_stock_holds_expiry_idx').on(t.expiresAt),
]);

export const promptpayStockHoldItems = pgTable('promptpay_stock_hold_items', {
  shopId: uuid('shop_id').notNull(),
  requestId: uuid('request_id').notNull(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  quantityMilliunits: bigint('quantity_milliunits', { mode: 'number' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.shopId, t.requestId, t.ingredientId] }),
  foreignKey({ columns: [t.shopId, t.requestId], foreignColumns: [promptpayStockHolds.shopId, promptpayStockHolds.requestId] }).onDelete('cascade'),
  check('promptpay_stock_hold_items_quantity_check', sql`${t.quantityMilliunits} > 0`),
]);

// Immutable, explicitly selected branch groups; one group per shop.
export const loyaltyGroups = pgTable('loyalty_groups', {
  id: id(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
});
export const loyaltyGroupShops = pgTable('loyalty_group_shops', {
  shopId: uuid('shop_id').primaryKey().references(() => shops.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => loyaltyGroups.id, { onDelete: 'cascade' }),
}, (t) => [index('loyalty_group_shops_group_idx').on(t.groupId)]);

export const shopSubscriptions = pgTable('shop_subscriptions', {
  shopId: uuid('shop_id').primaryKey().references(() => shops.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('basic'),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }).notNull().defaultNow(),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }).notNull(),
  paidUntil: timestamp('paid_until', { withTimezone: true }),
}, (t) => [
  check('shop_subscriptions_plan_check', sql`${t.plan} in ('basic','pro')`),
  check('shop_subscriptions_trial_check', sql`${t.trialEndsAt} > ${t.trialStartedAt}`),
]);

export const subscriptionPayments = pgTable('subscription_payments', {
  id: id(),
  shopId: shopId(),
  requestId: uuid('request_id').notNull(),
  plan: text('plan').notNull(),
  paidAmountSatang: integer('paid_amount_satang').notNull(),
  periodDays: integer('period_days').notNull(),
  periodStartsAt: timestamp('period_starts_at', { withTimezone: true }).notNull(),
  periodEndsAt: timestamp('period_ends_at', { withTimezone: true }).notNull(),
  externalReceiptRef: text('external_receipt_ref').notNull(),
  recordedByStaffId: uuid('recorded_by_staff_id').notNull().references(() => staff.id),
  recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('subscription_payments_request_uidx').on(t.shopId, t.requestId),
  uniqueIndex('subscription_payments_receipt_uidx').on(t.externalReceiptRef),
  check('subscription_payments_plan_check', sql`${t.plan} in ('basic','pro')`),
  check('subscription_payments_amount_check', sql`${t.paidAmountSatang} > 0`),
  check('subscription_payments_period_check', sql`${t.periodDays} between 1 and 366 and ${t.periodEndsAt} > ${t.periodStartsAt}`),
  check('subscription_payments_reference_check', sql`length(trim(${t.externalReceiptRef})) between 1 and 200`),
]);

export const providerPaymentIntents = pgTable('provider_payment_intents', {
  id: id(),
  shopId: shopId(),
  selfOrderId: uuid('self_order_id').notNull().references(() => selfOrders.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id),
  amountSatang: integer('amount_satang').notNull(),
  currency: text('currency').notNull().default('thb'),
  testMode: boolean('test_mode').notNull(),
  checkoutInput: jsonb('checkout_input').notNull(),
  providerAccountId: text('provider_account_id'),
  providerChargeId: text('provider_charge_id'),
  status: text('status').notNull().default('creating'),
  qrImageUrl: text('qr_image_url'),
  discrepancyCode: text('discrepancy_code'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  orderId: uuid('order_id').references(() => orders.id),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('provider_intents_draft_uidx').on(t.selfOrderId),
  uniqueIndex('provider_intents_charge_uidx').on(t.providerAccountId, t.providerChargeId),
  check('provider_intents_amount_check', sql`${t.amountSatang} between 2000 and 15000000 and ${t.currency} = 'thb'`),
  check('provider_intents_status_check', sql`${t.status} in ('creating','uncertain','pending','verified','paid_unfulfilled','discrepancy','completed','failed','expired')`),
  check('provider_intents_completed_check', sql`${t.status} <> 'completed' or (${t.orderId} is not null and ${t.verifiedAt} is not null)`),
]);

export const providerWebhookEvents = pgTable('provider_webhook_events', {
  shopId: shopId(),
  eventId: text('event_id').notNull(),
  intentId: uuid('intent_id').references(() => providerPaymentIntents.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.shopId, t.eventId] })]);

export const contactMessages = pgTable('contact_messages', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  shopName: text('shop_name'),
  topic: text('topic').notNull(),
  message: text('message').notNull(),
  clientAddressHash: text('client_address_hash').notNull(),
  createdAt: createdAt(),
}, (t) => [index('contact_messages_created_at_idx').on(t.createdAt)]).enableRLS();
