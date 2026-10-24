import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("manual pilot subscriptions", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: import("../src/subscriptions.service.js").SubscriptionsService;
  let requireFeature: typeof import("../src/subscriptions.service.js").requireShopFeature;
  let operatorUser: string;
  let ownerUser: string;
  let ingredientId: string;
  let productId: string;
  const oldAllowlist = process.env.BILLING_OPERATOR_USER_IDS;
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    const { SubscriptionsService, requireShopFeature } = await import("../src/subscriptions.service.js");
    service = new SubscriptionsService(fixture.database as never);
    requireFeature = requireShopFeature;
    const sql = fixture.database.connection;
    const [operator] = await sql`insert into users(email,password_hash) values (${`operator-${randomUUID()}@test.invalid`},'fixture') returning id`;
    const [owner] = await sql`insert into users(email,password_hash) values (${`owner-${randomUUID()}@test.invalid`},'fixture') returning id`;
    operatorUser = operator.id; ownerUser = owner.id;
    await sql`update staff set auth_user_id=${operatorUser} where id=${fixture.managerId}`;
    await sql`update staff set auth_user_id=${ownerUser} where id=${fixture.ownerId}`;
    process.env.BILLING_OPERATOR_USER_IDS = operatorUser;
  });
  after(async () => {
    if (oldAllowlist === undefined) { delete process.env.BILLING_OPERATOR_USER_IDS; } else { process.env.BILLING_OPERATOR_USER_IDS = oldAllowlist; }
    const sql = fixture?.database.connection;
    try {
      if (sql && operatorUser && ownerUser) {
        await sql`delete from shops where id=${fixture.shopId} or id in (select shop_id from staff where id=${fixture.otherShopOwnerId})`;
        await sql`delete from users where id in (${operatorUser},${ownerUser})`;
      }
    } finally { await fixture?.dispose(); }
  });

  it("lazily grants a full 14-day pro trial without resetting it on reads", async () => {
    const [state, parallel] = await Promise.all([
      service.get(fixture.shopId, fixture.ownerId, ownerUser),
      service.get(fixture.shopId, fixture.managerId, operatorUser),
      requireFeature(fixture.database.connection, fixture.shopId, 'inventory-write'),
    ]);
    assert.equal(parallel.trialEndsAt, state.trialEndsAt);
    const [count] = await fixture.database.connection`select count(*)::int as n from shop_subscriptions where shop_id=${fixture.shopId}`;
    assert.equal(count.n, 1);
    assert.equal(state.status, 'trial');
    assert.equal(state.effectivePlan, 'pro');
    assert.equal(state.canRecordPayment, false);
    assert.equal(Date.parse(state.trialEndsAt) - Date.parse(state.trialStartedAt), 14 * 86400000);
    assert.equal((await service.get(fixture.shopId, fixture.managerId, operatorUser)).trialEndsAt, state.trialEndsAt);
    await requireFeature(fixture.database.connection, fixture.shopId, 'inventory-write');
    const { InventoryService } = await import("../src/inventory.service.js");
    const inventory = new InventoryService(fixture.database as never);
    ingredientId = (await inventory.createIngredient(fixture.shopId, fixture.ownerId, { name: 'Trial beans', unit: 'g', lowStockMilliunits: 0 })).id;
    await inventory.move(fixture.shopId, fixture.ownerId, ingredientId, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000, reason: 'Opening stock' });
    const [product] = await fixture.database.connection`insert into products(shop_id,name,base_price_satang) values (${fixture.shopId},'Trial coffee',100) returning id`;
    productId = product.id;
    await inventory.setRecipe(fixture.shopId, fixture.ownerId, 'product', productId, [{ ingredientId, quantityMilliunits: 1000 }]);
  });

  it("keeps core recovery available but blocks expired pro writes", async () => {
    const { InventoryService } = await import("../src/inventory.service.js");
    const { OrdersService } = await import("../src/orders.service.js");
    const { ShiftsService } = await import("../src/shifts.service.js");
    const orders = new OrdersService(fixture.database as never);
    const shifts = new ShiftsService(fixture.database as never);
    await shifts.open(fixture.shopId, fixture.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    const input = { requestId: randomUUID(), lines: [{ productId, qty: 1, modifierIds: [] }], payment: { method: "cash" as const, cashReceivedSatang: 100 } };
    await orders.checkout(fixture.shopId, fixture.ownerId, input);
    const inventory = new InventoryService(fixture.database as never);
    assert.equal((await inventory.list(fixture.shopId, fixture.ownerId)).ingredients[0].onHandMilliunits, 0);
    await fixture.database.connection`update shop_subscriptions set trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day' where shop_id=${fixture.shopId}`;
    await requireFeature(fixture.database.connection, fixture.shopId, 'core-pos');
    await assert.rejects(requireFeature(fixture.database.connection, fixture.shopId, 'self-order'), ForbiddenException);
    assert.equal((await service.get(fixture.shopId, fixture.ownerId, ownerUser)).status, 'expired');
    assert.equal((await inventory.list(fixture.shopId, fixture.ownerId)).ingredients.length, 1);
    await assert.rejects(inventory.createIngredient(fixture.shopId, fixture.ownerId,
      { name: 'Denied', unit: 'g', lowStockMilliunits: 0 }), ForbiddenException);
    await assert.rejects(inventory.setThreshold(fixture.shopId, fixture.ownerId, ingredientId, 1000), ForbiddenException);
    await assert.rejects(inventory.setRecipe(fixture.shopId, fixture.ownerId, 'product', productId, []), ForbiddenException);
    await inventory.move(fixture.shopId, fixture.ownerId, ingredientId,
      { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000, reason: 'Replenish to continue sales' });
    await orders.checkout(fixture.shopId, fixture.ownerId, { ...input, requestId: randomUUID() });
    assert.equal((await inventory.list(fixture.shopId, fixture.ownerId)).ingredients[0].onHandMilliunits, 0);
  });

  it("prevents owner self-approval and forged user/staff bindings", async () => {
    const input = { requestId: randomUUID(), plan: 'basic' as const, paidAmountSatang: 50000, periodDays: 30, externalReceiptRef: `receipt-${randomUUID()}` };
    await assert.rejects(service.renew(fixture.shopId, fixture.ownerId, ownerUser, input), ForbiddenException);
    await assert.rejects(service.renew(fixture.shopId, fixture.ownerId, operatorUser, input), ForbiddenException);
    await assert.rejects(service.renew(fixture.shopId, fixture.otherShopOwnerId, operatorUser, input), ForbiddenException);
    await assert.rejects(service.get(fixture.shopId, fixture.managerId, ownerUser), ForbiddenException);
  });

  it("records an operator's manual payment and extends once under concurrent retries", async () => {
    const input = { requestId: randomUUID(), plan: 'basic' as const, paidAmountSatang: 50000, periodDays: 30, externalReceiptRef: `receipt-${randomUUID()}` };
    const [first, second] = await Promise.all([
      service.renew(fixture.shopId, fixture.managerId, operatorUser, input),
      service.renew(fixture.shopId, fixture.managerId, operatorUser, input),
    ]);
    assert.deepEqual(first, second);
    const state = await service.get(fixture.shopId, fixture.ownerId, ownerUser);
    assert.equal(state.status, 'active'); assert.equal(state.effectivePlan, 'basic');
    assert.equal(state.payments.length, 1);
    assert.equal(state.payments[0].paidAmountSatang, 50000);
    assert.equal(Date.parse(state.payments[0].periodEndsAt) - Date.parse(state.payments[0].periodStartsAt), 30 * 86400000);
    assert.equal(state.paidUntil, state.payments[0].periodEndsAt);
    await assert.rejects(requireFeature(fixture.database.connection, fixture.shopId, 'inventory-write'), ForbiddenException);
    await assert.rejects(service.renew(fixture.shopId, fixture.managerId, operatorUser, { ...input, paidAmountSatang: 60000 }), ConflictException);
    assert.deepEqual(await service.renew(fixture.shopId, fixture.managerId, operatorUser, { ...input, requestId: randomUUID() }), first);
  });

  it("a pro renewal extends from the current end and unlocks pro mutations", async () => {
    const before = await service.get(fixture.shopId, fixture.ownerId, ownerUser);
    await service.renew(fixture.shopId, fixture.managerId, operatorUser,
      { requestId: randomUUID(), plan: 'pro', paidAmountSatang: 100000, periodDays: 31, externalReceiptRef: `receipt-${randomUUID()}` });
    const state = await service.get(fixture.shopId, fixture.ownerId, ownerUser);
    assert.equal(Date.parse(state.paidUntil!) - Date.parse(before.paidUntil!), 31 * 86400000);
    assert.equal(state.payments.length, 2);
    await requireFeature(fixture.database.connection, fixture.shopId, 'shared-loyalty');
  });
  it("rejects invalid manual amounts and keeps an unconfigured operator allowlist closed", async () => {
    const input = { requestId: randomUUID(), plan: 'pro' as const, paidAmountSatang: 1000, periodDays: 30, externalReceiptRef: `receipt-${randomUUID()}` };
    for (const changes of [{ paidAmountSatang: 0 }, { paidAmountSatang: 0.5 }, { periodDays: 0 }, { periodDays: 367 }, { externalReceiptRef: ' ' }]) {
      await assert.rejects(service.renew(fixture.shopId, fixture.managerId, operatorUser, { ...input, ...changes }), BadRequestException);
    }
    delete process.env.BILLING_OPERATOR_USER_IDS;
    try {
      assert.equal((await service.get(fixture.shopId, fixture.managerId, operatorUser)).canRecordPayment, false);
      await assert.rejects(service.renew(fixture.shopId, fixture.managerId, operatorUser, input), ForbiddenException);
    } finally { process.env.BILLING_OPERATOR_USER_IDS = operatorUser; }
  });

  it("preserves remaining trial time and prevents one receipt from renewing a second shop", async () => {
    const sql = fixture.database.connection;
    const [other] = await sql`update staff set auth_user_id=${operatorUser} where id=${fixture.otherShopOwnerId} returning shop_id`;
    const before = await service.get(other.shop_id, fixture.otherShopOwnerId, operatorUser);
    const input = { requestId: randomUUID(), plan: 'basic' as const, paidAmountSatang: 1000, periodDays: 7, externalReceiptRef: `receipt-${randomUUID()}` };
    await service.renew(other.shop_id, fixture.otherShopOwnerId, operatorUser, input);
    const after = await service.get(other.shop_id, fixture.otherShopOwnerId, operatorUser);
    assert.equal(after.status, 'trial');
    assert.equal(after.effectivePlan, 'pro');
    assert.equal(Date.parse(after.paidUntil!) - Date.parse(before.trialEndsAt), 7 * 86400000);
    await assert.rejects(service.renew(fixture.shopId, fixture.managerId, operatorUser, { ...input, requestId: randomUUID() }), ConflictException);
    await sql`delete from shops where id=${other.shop_id}`;
  });

});
