import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { OrdersService } from "../src/orders.service.js";
import { ShiftsService } from "../src/shifts.service.js";
import { InventoryService } from "../src/inventory.service.js";
import { PreparationService } from "../src/preparation.service.js";
import { ReportsService } from "../src/reports.service.js";
import { RefundsService } from "../src/refunds.service.js";
import { createPaymentSettingsFixture } from "./payment-settings-fixture.js";

const database = process.env.TEST_DATABASE_URL;

test("paid bills require refund approval while unpaid cancellation moves no money", { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? "");
  try {
    const sql = f.database.connection;
    const service = new OrdersService(f.database as never);
    const [paid] = await sql`insert into orders(shop_id,daily_no,business_date,status,total_satang)
      values(${f.shopId},1,'2026-10-25','paid',7000) returning id`;
    await sql`insert into payments(order_id,method,amount_satang,confirmed_by) values(${paid.id},'cash',7000,${f.ownerId})`;
    await assert.rejects(service.voidOrder(f.shopId, paid.id, f.ownerId), ConflictException);
    assert.equal((await sql`select status from orders where id=${paid.id}`)[0].status, "paid");
    const [unpaid] = await sql`insert into orders(shop_id,daily_no,business_date,status)
      values(${f.shopId},2,'2026-10-25','open') returning id`;
    await service.voidOrder(f.shopId, unpaid.id, f.ownerId);
    assert.equal((await sql`select status from orders where id=${unpaid.id}`)[0].status, "void");
    assert.equal((await sql`select count(*)::int as n from payments where order_id=${unpaid.id}`)[0].n, 0);
  } finally { await f.dispose(); }
});

test("drawer movements require manager approval and reconcile exactly once", { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? "");
  try {
    const shifts = new ShiftsService(f.database as never);
    const shift = await shifts.open(f.shopId, f.baristaId, { requestId: randomUUID(), openingFloatSatang: 50_000 });
    const input = { requestId: randomUUID(), kind: "float_topup" as const, amountSatang: 20_000, reason: "Change for lunch" };
    await assert.rejects(shifts.recordMovement(f.shopId, f.baristaId, shift.id, input), ForbiddenException);
    const movement = await shifts.recordMovement(f.shopId, f.managerId, shift.id, input);
    assert.deepEqual(await shifts.recordMovement(f.shopId, f.managerId, shift.id, input), movement);
    await assert.rejects(shifts.recordMovement(f.shopId, f.managerId, shift.id, { ...input, amountSatang: 10_000 }), ConflictException);
    await shifts.recordMovement(f.shopId, f.ownerId, shift.id, { requestId: randomUUID(), kind: "petty_cash", amountSatang: 5000, reason: "Ice delivery" });
    await shifts.recordMovement(f.shopId, f.ownerId, shift.id, { requestId: randomUUID(), kind: "bank_deposit", amountSatang: 30_000, reason: "Bank run" });
    assert.equal((await shifts.list(f.shopId, f.ownerId)).shifts[0].expectedCashSatang, 35_000);
    const closed = await shifts.close(f.shopId, f.ownerId, shift.id, { requestId: randomUUID(), countedCashSatang: 35_000 });
    assert.equal(closed.differenceSatang, 0);
    await assert.rejects(shifts.recordMovement(f.shopId, f.ownerId, shift.id, { ...input, requestId: randomUUID() }), ConflictException);
  } finally { await f.dispose(); }
});

test("checkout reserves stock, partial cancellation releases it, preparation consumes only remaining cups", { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? "");
  try {
    const sql = f.database.connection;
    await sql`update shops set stock_consumption='preparation' where id=${f.shopId}`;
    const inventory = new InventoryService(f.database as never);
    const orders = new OrdersService(f.database as never);
    const prep = new PreparationService(f.database as never);
    const refunds = new RefundsService(f.database as never);
    const [product] = await sql`insert into products(shop_id,name,base_price_satang) values(${f.shopId},'Coffee',7000) returning id`;
    const milk = await inventory.createIngredient(f.shopId, f.ownerId, { name: "Milk", unit: "ml", lowStockMilliunits: 0 });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: "receive", quantityMilliunits: 400_000, reason: "Opening stock" });
    await inventory.setRecipe(f.shopId, f.ownerId, "product", product.id, [{ ingredientId: milk.id, quantityMilliunits: 200_000 }]);
    await new ShiftsService(f.database as never).open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    const order = await orders.checkout(f.shopId, f.ownerId, { requestId: randomUUID(), lines: [{ productId: product.id, qty: 2, modifierIds: [] }], payment: { method: "cash", cashReceivedSatang: 14_000 } });
    assert.equal((await inventory.list(f.shopId, f.ownerId)).ingredients[0].onHandMilliunits, 400_000);
    assert.equal((await inventory.list(f.shopId, f.ownerId)).ingredients[0].availableMilliunits, 0);
    await assert.rejects(inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'waste', quantityMilliunits: 1, reason: 'Cannot spend reserved milk' }), ConflictException);
    await assert.rejects(orders.checkout(f.shopId, f.ownerId, { requestId: randomUUID(), lines: [{ productId: product.id, qty: 1, modifierIds: [] }], payment: { method: 'cash', cashReceivedSatang: 7000 } }), ConflictException);
    await inventory.setRecipe(f.shopId, f.ownerId, 'product', product.id, [{ ingredientId: milk.id, quantityMilliunits: 100000 }]);
    const [item] = await sql`select id from order_items where order_id=${order.orderId}`;
    await refunds.create(f.shopId, f.ownerId, order.orderId, { requestId: randomUUID(), reason: "Cancel one before preparation", lines: [{ itemId: item.id, qty: 1 }] });
    const [date] = await sql`select business_date from orders where id=${order.orderId}`;
    const pending = await new ReportsService(f.database as never).marginByItem(f.shopId, { from: date.business_date, to: date.business_date });
    assert.equal(pending.items[0].pendingQty, 1);
    assert.equal(pending.items[0].marginSatang, null);
    await sql`update orders set business_date='2000-01-01' where id=${order.orderId}`;
    assert.equal((await prep.list(f.shopId, f.baristaId))[0].items[0].qty, 1);
    await prep.transition(f.shopId, f.baristaId, order.orderId, "received", "preparing");
    await prep.transition(f.shopId, f.baristaId, order.orderId, "received", "preparing");
    assert.equal((await inventory.list(f.shopId, f.ownerId)).ingredients[0].onHandMilliunits, 200_000);
    await refunds.create(f.shopId, f.ownerId, order.orderId, { requestId: randomUUID(), reason: "Refund prepared drink", lines: [{ itemId: item.id, qty: 1 }] });
    assert.equal((await inventory.list(f.shopId, f.ownerId)).ingredients[0].onHandMilliunits, 200_000);
  } finally { await f.dispose(); }
});

test('weighted average purchase cost and immutable sale snapshots survive later purchases', { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? '');
  try {
    const sql = f.database.connection;
    const inventory = new InventoryService(f.database as never);
    const milk = await inventory.createIngredient(f.shopId, f.ownerId, { name: 'Costed milk', unit: 'ml', lowStockMilliunits: 0 });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, reason: 'First litre', costSatang: 5000 });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, reason: 'Second litre', costSatang: 7000 });
    const [product] = await sql`insert into products(shop_id,name,base_price_satang) values(${f.shopId},'Costed latte',7000) returning id`;
    await inventory.setRecipe(f.shopId, f.ownerId, 'product', product.id, [{ ingredientId: milk.id, quantityMilliunits: 200000 }]);
    await new ShiftsService(f.database as never).open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    const order = await new OrdersService(f.database as never).checkout(f.shopId, f.ownerId, { requestId: randomUUID(), lines: [{ productId: product.id, qty: 1, modifierIds: [] }], payment: { method: 'cash', cashReceivedSatang: 7000 } });
    const [snapshot] = await sql`select cost_satang::float8 as cost from order_items where order_id=${order.orderId}`;
    assert.equal(snapshot.cost, 1200);
    const [date] = await sql`select business_date from orders where id=${order.orderId}`;
    const report = await new ReportsService(f.database as never).marginByItem(f.shopId, { from: date.business_date, to: date.business_date });
    assert.deepEqual(report.items[0], { name: 'Costed latte', qty: 1, revenueSatang: 7000, knownCostSatang: 1200, unknownCostQty: 0, pendingQty: 0, marginSatang: 5800 });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, reason: 'Expensive litre', costSatang: 12000 });
    assert.equal((await sql`select cost_satang::float8 as cost from order_items where order_id=${order.orderId}`)[0].cost, 1200);
    const remake = { requestId: randomUUID(), qty: 1, reason: 'Spilled cup' };
    const [item] = await sql`select id from order_items where order_id=${order.orderId}`;
    const result = await inventory.remake(f.shopId, f.baristaId, order.orderId, item.id, remake);
    assert.deepEqual(await inventory.remake(f.shopId, f.baristaId, order.orderId, item.id, remake), result);
    await assert.rejects(inventory.remake(f.shopId, f.baristaId, order.orderId, item.id, { ...remake, reason: 'Changed replay' }), ConflictException);
    await assert.rejects(inventory.remake(f.shopId, f.otherShopOwnerId, order.orderId, item.id, { ...remake, requestId: randomUUID() }), ForbiddenException);
    assert.equal((await sql`select count(*)::int as n from payments where order_id=${order.orderId}`)[0].n, 1);
    assert.equal((await sql`select count(*)::int as n from inventory_movements where order_id=${order.orderId} and kind='remake'`)[0].n, 1);
    const after = await new ReportsService(f.database as never).marginByItem(f.shopId, { from: date.business_date, to: date.business_date });
    assert.equal(after.remakeCostSatang, 1629);
    assert.equal(after.items[0].knownCostSatang, 1200);
  } finally { await f.dispose(); }
});

test('reward refunds return paid addons first and never reverse stamps for the free cup', { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? '');
  try {
    const sql = f.database.connection;
    const [product] = await sql`insert into products(shop_id,name,base_price_satang,earns_stamp) values(${f.shopId},'Reward latte',5000,true) returning id`;
    const [group] = await sql`insert into modifier_groups(shop_id,name,min_select,max_select) values(${f.shopId},'Extras',0,1) returning id`;
    const [modifier] = await sql`insert into modifiers(group_id,name,price_delta_satang) values(${group.id},'Oat',1000) returning id`;
    await sql`insert into product_modifier_groups(product_id,group_id) values(${product.id},${group.id})`;
    const [member] = await sql`insert into members(shop_id,display_name) values(${f.shopId},'Reward member') returning id`;
    const [reward] = await sql`insert into rewards(shop_id,member_id,expires_at) values(${f.shopId},${member.id},now()+interval '1 month') returning id`;
    await new ShiftsService(f.database as never).open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    const order = await new OrdersService(f.database as never).checkout(f.shopId, f.ownerId, {
      requestId: randomUUID(), memberId: member.id, redeemRewardId: reward.id,
      lines: [{ productId: product.id, qty: 2, modifierIds: [modifier.id] }], payment: { method: 'cash', cashReceivedSatang: 7000 },
    });
    assert.equal(order.totalSatang, 7000); assert.equal(order.stampsEarned, 1);
    const [item] = await sql`select id from order_items where order_id=${order.orderId}`;
    const refunds = new RefundsService(f.database as never);
    const first = await refunds.create(f.shopId, f.ownerId, order.orderId, { requestId: randomUUID(), reason: 'Reward cup returned', lines: [{ itemId: item.id, qty: 1 }] });
    assert.equal(first.amountSatang, 1000);
    assert.equal((await sql`select lines from refunds where id=${first.id}`)[0].lines[0].stampsReversed, 0);
    const second = await refunds.create(f.shopId, f.ownerId, order.orderId, { requestId: randomUUID(), reason: 'Paid cup returned', lines: [{ itemId: item.id, qty: 1 }] });
    assert.equal(second.amountSatang, 6000);
    assert.equal((await sql`select lines from refunds where id=${second.id}`)[0].lines[0].stampsReversed, 1);
    assert.equal((await sql`select status from rewards where id=${reward.id}`)[0].status, 'available');
  } finally { await f.dispose(); }
});

test('missing ingredient costs withhold margin instead of inventing a zero cost', { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? '');
  try {
    const sql = f.database.connection;
    const inventory = new InventoryService(f.database as never);
    const milk = await inventory.createIngredient(f.shopId, f.ownerId, { name: 'Unknown milk', unit: 'ml', lowStockMilliunits: 0 });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, reason: 'Legacy receipt' });
    await inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, costSatang: 6000, reason: 'Priced receipt' });
    const [product] = await sql`insert into products(shop_id,name,base_price_satang) values(${f.shopId},'Unknown cost latte',7000) returning id`;
    await inventory.setRecipe(f.shopId, f.ownerId, 'product', product.id, [{ ingredientId: milk.id, quantityMilliunits: 200000 }]);
    await new ShiftsService(f.database as never).open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    const order = await new OrdersService(f.database as never).checkout(f.shopId, f.ownerId, { requestId: randomUUID(), lines: [{ productId: product.id, qty: 1, modifierIds: [] }], payment: { method: 'cash', cashReceivedSatang: 7000 } });
    const [date] = await sql`select business_date from orders where id=${order.orderId}`;
    const report = await new ReportsService(f.database as never).marginByItem(f.shopId, { from: date.business_date, to: date.business_date });
    assert.equal(report.items[0].unknownCostQty, 1);
    assert.equal(report.items[0].marginSatang, null);
    assert.equal((await sql`select cost_satang from order_items where order_id=${order.orderId}`)[0].cost_satang, null);
    await inventory.valueStock(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), onHandMilliunits: 1800000, costSatang: 10800, reason: 'Opening valuation from invoice' });
    assert.equal(Number((await sql`select average_cost_per_milliunit as cost from ingredients where id=${milk.id}`)[0].cost), 0.006);
    await assert.rejects(inventory.move(f.shopId, f.ownerId, milk.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000, reason: 'Missing purchase cost' }));
    assert.equal((await sql`select cost_satang from order_items where order_id=${order.orderId}`)[0].cost_satang, null);
  } finally { await f.dispose(); }
});
