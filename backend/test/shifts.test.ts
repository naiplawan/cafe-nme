import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("cash drawer shifts", { skip: !process.env.TEST_DATABASE_URL, concurrency: false }, () => {
  let fixture: PaymentSettingsFixture;
  let service: import("../src/shifts.service.js").ShiftsService;
  let shiftId: string;
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    const { ShiftsService } = await import("../src/shifts.service.js");
    service = new ShiftsService(fixture.database as never);
  });
  after(async () => { await fixture?.dispose(); });

  it("rejects cash checkout without an open shift instead of creating uncounted cash", async () => {
    const { OrdersService } = await import("../src/orders.service.js");
    const orders = new OrdersService(fixture.database as never);
    const sql = fixture.database.connection;
    const [product] = await sql`insert into products(shop_id,name,base_price_satang)
      values (${fixture.shopId},'No-shift coffee',6500) returning id`;
    const input = { requestId: randomUUID(), lines: [{ productId: product.id as string, qty: 1, modifierIds: [] }],
      payment: { method: "cash" as const, cashReceivedSatang: 6500 } };

    await assert.rejects(orders.checkout(fixture.shopId, fixture.baristaId, input), BadRequestException);
    const [count] = await sql`select count(*)::int as n from orders where shop_id=${fixture.shopId}`;
    assert.equal(count.n, 0);
  });

  it("serializes concurrent openings into one active drawer and replays the opening request", async () => {
    const input = { requestId: randomUUID(), openingFloatSatang: 10000 };
    const ownerInput = { ...input, requestId: randomUUID() };
    const attempts = await Promise.allSettled([
      service.open(fixture.shopId, fixture.baristaId, input),
      service.open(fixture.shopId, fixture.ownerId, ownerInput),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    const state = await service.list(fixture.shopId, fixture.baristaId);
    assert.equal(state.shifts.length, 1);
    shiftId = state.shifts[0].id;
    assert.equal(state.shifts[0].expectedCashSatang, 10000);
    const winner = attempts[0].status === "fulfilled" ? fixture.baristaId : fixture.ownerId;
    const winnerInput = attempts[0].status === "fulfilled" ? input : ownerInput;
    assert.equal((await service.open(fixture.shopId, winner, winnerInput)).id, shiftId);
  });

  it("rejects inactive/foreign actors and foreign handoff without closing", async () => {
    for (const actor of [fixture.otherShopOwnerId, fixture.inactiveOwnerId]) {
      await assert.rejects(service.list(fixture.shopId, actor), ForbiddenException);
      await assert.rejects(service.close(fixture.shopId, actor, shiftId, { requestId: randomUUID(), countedCashSatang: 0 }), ForbiddenException);
      await assert.rejects(service.open(fixture.shopId, actor, { requestId: randomUUID(), openingFloatSatang: 0 }), ForbiddenException);
    }
    await assert.rejects(service.close(fixture.shopId, fixture.ownerId, shiftId,
      { requestId: randomUUID(), countedCashSatang: 10000, handedToStaffId: fixture.otherShopOwnerId }), ForbiddenException);
  });

  it("rejects invalid money and foreign shift IDs before any cash mutation", async () => {
    for (const amount of [-1, 0.5, 2147483648]) {
      await assert.rejects(service.open(fixture.shopId, fixture.ownerId,
        { requestId: randomUUID(), openingFloatSatang: amount }), BadRequestException);
      await assert.rejects(service.close(fixture.shopId, fixture.ownerId, shiftId,
        { requestId: randomUUID(), countedCashSatang: amount }), BadRequestException);
    }
    await assert.rejects(service.close(fixture.shopId, fixture.ownerId, randomUUID(),
      { requestId: randomUUID(), countedCashSatang: 0 }), NotFoundException);
  });

  it("counts cash across dates, does not treat void as a payout, and closes immutably on retry", async () => {
    const sql = fixture.database.connection;
    for (const [dailyNo, date, status, method, amount] of [
      [1, "2026-10-23", "paid", "cash", 6500],
      [1, "2026-10-24", "void", "cash", 3500],
      [2, "2026-10-24", "paid", "promptpay", 9000],
    ] as const) {
      const [order] = await sql`insert into orders (shop_id,shift_id,daily_no,business_date,status,total_satang)
        values (${fixture.shopId},${shiftId},${dailyNo},${date},${status},${amount}) returning id`;
      await sql`insert into payments(order_id,method,amount_satang,confirmed_by) values (${order.id},${method},${amount},${fixture.baristaId})`;
    }
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).shifts[0].expectedCashSatang, 20000);
    const input = { requestId: randomUUID(), countedCashSatang: 19500, handedToStaffId: fixture.managerId };
    const closed = await service.close(fixture.shopId, fixture.ownerId, shiftId, input);
    assert.equal(closed.expectedCashSatang, 20000);
    assert.equal(closed.differenceSatang, -500);
    assert.ok(closed.closedAt);
    assert.deepEqual(await service.close(fixture.shopId, fixture.ownerId, shiftId, input), closed);
    await assert.rejects(service.close(fixture.shopId, fixture.ownerId, shiftId, { ...input, countedCashSatang: 20000 }), ConflictException);
    await assert.rejects(service.close(fixture.shopId, fixture.ownerId, shiftId, { ...input, requestId: randomUUID() }), ConflictException);
  });
  it("links cash checkout once on replay and keeps a closed count stable after rejecting a paid-order void", async () => {
    const { OrdersService } = await import("../src/orders.service.js");
    const orders = new OrdersService(fixture.database as never);
    const sql = fixture.database.connection;
    const [product] = await sql`insert into products(shop_id,name,base_price_satang)
      values (${fixture.shopId},'Shift test coffee',6500) returning id`;
    const opened = await service.open(fixture.shopId, fixture.baristaId, { requestId: randomUUID(), openingFloatSatang: 1000 });
    const input = { requestId: randomUUID(), lines: [{ productId: product.id as string, qty: 1, modifierIds: [] }],
      payment: { method: "cash" as const, cashReceivedSatang: 10000 } };
    const [first, second] = await Promise.all([
      orders.checkout(fixture.shopId, fixture.baristaId, input),
      orders.checkout(fixture.shopId, fixture.baristaId, input),
    ]);
    assert.equal(first.orderId, second.orderId);
    assert.equal((await service.list(fixture.shopId, fixture.baristaId)).shifts.find((row) => row.id === opened.id)?.expectedCashSatang, 7500);
    const closeInput = { requestId: randomUUID(), countedCashSatang: 7500 };
    const closed = await service.close(fixture.shopId, fixture.baristaId, opened.id, closeInput);
    await assert.rejects(orders.voidOrder(fixture.shopId, first.orderId, fixture.ownerId), ConflictException);
    assert.deepEqual(await service.close(fixture.shopId, fixture.baristaId, opened.id, closeInput), closed);
    const replay = await orders.checkout(fixture.shopId, fixture.baristaId, input);
    assert.equal(replay.orderId, first.orderId);
  });

  it("serializes checkout versus closing so a closed snapshot always equals its linked cash", async () => {
    const { OrdersService } = await import("../src/orders.service.js");
    const orders = new OrdersService(fixture.database as never);
    const [product] = await fixture.database.connection`select id from products where shop_id=${fixture.shopId} limit 1`;
    const opened = await service.open(fixture.shopId, fixture.ownerId, { requestId: randomUUID(), openingFloatSatang: 500 });
    await assert.rejects(service.close(fixture.shopId, fixture.baristaId, opened.id,
      { requestId: randomUUID(), countedCashSatang: 500 }), ForbiddenException);
    const [closedResult, checkoutResult] = await Promise.allSettled([
      service.close(fixture.shopId, fixture.ownerId, opened.id, { requestId: randomUUID(), countedCashSatang: 500 }),
      orders.checkout(fixture.shopId, fixture.baristaId, {
        requestId: randomUUID(), lines: [{ productId: product.id, qty: 1, modifierIds: [] }],
        payment: { method: "cash", cashReceivedSatang: 6500 },
      }),
    ]);
    assert.equal(closedResult.status, "fulfilled");
    if (closedResult.status !== "fulfilled") { return; }
    if (checkoutResult.status === "fulfilled") {
      const [order] = await fixture.database.connection`select shift_id from orders where id=${checkoutResult.value.orderId}`;
      assert.equal(order.shift_id, opened.id);
      assert.equal(closedResult.value.expectedCashSatang, 7000);
    } else {
      assert.ok(checkoutResult.reason instanceof BadRequestException);
      assert.equal(closedResult.value.expectedCashSatang, 500);
    }
  });

});
