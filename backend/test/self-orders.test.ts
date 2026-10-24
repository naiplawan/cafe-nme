import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { after, before, describe, it } from "node:test";
import { OrdersService } from "../src/orders.service.js";
import { SelfOrdersService, lockSelfOrderForCheckout, completeSelfOrderCheckout } from "../src/self-orders.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("self-order drafts", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: SelfOrdersService;
  let productId: string;
  let modifierId: string;
  let id: string;
  const token = randomBytes(32).toString("hex");
  const key = randomUUID();
  const input = () => ({ clientKey: key, statusToken: token, mode: "pickup" as const, tableLabel: null, lines: [{ productId, qty: 2, modifierIds: [modifierId], note: "Less sweet" }] });
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL ?? "");
    service = new SelfOrdersService(fixture.database as never);
    const sql = fixture.database.connection;
    const [product] = await sql`insert into products(shop_id,name,base_price_satang) values(${fixture.shopId},'Coffee',5000) returning id`;
    productId = product.id;
    const [group] = await sql`insert into modifier_groups(shop_id,name,min_select,max_select) values(${fixture.shopId},'Milk',1,1) returning id`;
    const [modifier] = await sql`insert into modifiers(group_id,name,price_delta_satang) values(${group.id},'Oat',1500) returning id`;
    modifierId = modifier.id;
    await sql`insert into product_modifier_groups(product_id,group_id) values(${productId},${group.id})`;
  });
  after(async () => { await fixture?.dispose(); });
  it("reprices a public submission as unpaid and deduplicates concurrent retries", async () => {
    const [first, retry] = await Promise.all([service.submit(fixture.shopId, input()), service.submit(fixture.shopId, input())]);
    assert.deepEqual(first, retry);
    id = first.id;
    assert.equal(first.status, "pending");
    assert.equal(first.totalSatang, 13000);
    assert.equal(first.dailyNo, null);
    assert.equal(first.items[0].name, "Coffee");
    const [count] = await fixture.database.connection`select count(*)::int as n from orders where shop_id=${fixture.shopId}`;
    assert.equal(count.n, 0);
  });
  it("binds idempotency to original payload and private status token", async () => {
    await assert.rejects(service.submit(fixture.shopId, { ...input(), lines: [{ ...input().lines[0], qty: 3 }] }), ConflictException);
    await assert.rejects(service.submit(fixture.shopId, { ...input(), statusToken: "f".repeat(64) }), ConflictException);
    assert.equal((await service.status(fixture.shopId, token)).id, id);
    await assert.rejects(service.status(fixture.shopId, "f".repeat(64)), NotFoundException);
  });
  it("rejects foreign catalog, missing modifiers, oversize notes, and sold-out products", async () => {
    const fresh = () => ({ ...input(), clientKey: randomUUID(), statusToken: randomBytes(32).toString("hex") });
    await assert.rejects(service.submit(fixture.shopId, { ...fresh(), lines: [{ ...input().lines[0], productId: randomUUID() }] }), BadRequestException);
    await assert.rejects(service.submit(fixture.shopId, { ...fresh(), lines: [{ ...input().lines[0], modifierIds: [] }] }), BadRequestException);
    await assert.rejects(service.submit(fixture.shopId, { ...fresh(), lines: [{ ...input().lines[0], note: "x".repeat(121) }] }), BadRequestException);
    await fixture.database.connection`update products set sold_out=true where id=${productId}`;
    await assert.rejects(service.submit(fixture.shopId, fresh()), BadRequestException);
    await fixture.database.connection`update products set sold_out=false where id=${productId}`;
  });
  it("requires same-shop active staff to inspect and accept drafts", async () => {
    for (const actor of [fixture.otherShopOwnerId, fixture.inactiveOwnerId]) {
      await assert.rejects(service.list(fixture.shopId, actor), ForbiddenException);
      await assert.rejects(service.decide(fixture.shopId, actor, id, "accepted"), ForbiddenException);
    }
    assert.equal((await service.list(fixture.shopId, fixture.baristaId))[0].id, id);
    await service.decide(fixture.shopId, fixture.baristaId, id, "accepted");
    const draft = await service.getAcceptedDraft(fixture.shopId, fixture.baristaId, id);
    assert.deepEqual(draft.lines, input().lines);
    assert.equal(draft.totalSatang, 13000);
    assert.equal(await fixture.database.connection.begin((tx) => lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, input().lines)), 13000);
    assert.equal((await service.status(fixture.shopId, token)).status, "accepted");
  });
  it("atomically links paid checkout once and rejects changed draft lines or amount", async () => {
    const sql = fixture.database.connection;
    await assert.rejects(sql.begin((tx) => lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, [{ ...input().lines[0], qty: 1 }], 13000)), ConflictException);
    await assert.rejects(sql.begin((tx) => lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, input().lines, 10000)), ConflictException);
    await assert.rejects(sql.begin(async (tx) => {
      await lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, input().lines, 13000);
      const [order] = await tx`insert into orders(shop_id,daily_no,business_date,status,total_satang) values(${fixture.shopId},1,'2026-10-23','paid',13000) returning id`;
      await completeSelfOrderCheckout(tx, fixture.shopId, id, order.id);
      throw new Error("rollback");
    }), /rollback/);
    assert.equal((await service.status(fixture.shopId, token)).status, "accepted");
    await sql.begin(async (tx) => {
      await lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, input().lines, 13000);
      const [order] = await tx`insert into orders(shop_id,daily_no,business_date,status,total_satang) values(${fixture.shopId},1,'2026-10-23','paid',13000) returning id`;
      await completeSelfOrderCheckout(tx, fixture.shopId, id, order.id);
    });
    assert.equal((await service.status(fixture.shopId, token)).status, "completed");
    assert.equal((await service.status(fixture.shopId, token)).dailyNo, 1);
    await assert.rejects(sql.begin((tx) => lockSelfOrderForCheckout(tx, fixture.shopId, fixture.baristaId, id, input().lines, 13000)), ConflictException);
  });
  it("normal checkout settles an accepted draft once across distinct request keys", async () => {
    const draft = await service.submit(fixture.shopId, { ...input(), clientKey: randomUUID(), statusToken: randomBytes(32).toString("hex") });
    await service.decide(fixture.shopId, fixture.baristaId, draft.id, "accepted");
    const orders = new OrdersService(fixture.database as never);
    const request = { requestId: randomUUID(), selfOrderId: draft.id, expectedTotalSatang: 13000, lines: input().lines, payment: { method: "cash" as const, cashReceivedSatang: 13000 } };
    await assert.rejects(orders.checkout(fixture.shopId, fixture.baristaId, { ...request, expectedTotalSatang: 6500, lines: [{ ...input().lines[0], qty: 1 }] }), ConflictException);
    const alternative = { ...request, requestId: randomUUID() };
    const results = await Promise.allSettled([
      orders.checkout(fixture.shopId, fixture.baristaId, request),
      orders.checkout(fixture.shopId, fixture.baristaId, alternative),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const first = results.find((result) => result.status === "fulfilled");
    if (first?.status === "fulfilled") {
      const replay = await orders.checkout(fixture.shopId, fixture.baristaId, results[0].status === "fulfilled" ? request : alternative);
      assert.equal(replay.orderId, first.value.orderId);
      assert.equal(replay.replayed, true);
    }
    const [linked] = await fixture.database.connection`select d.status,o.prep_status from self_orders d join orders o on o.id=d.order_id where d.id=${draft.id}`;
    assert.deepEqual(linked, { status: "completed", prep_status: "received" });
    await assert.rejects(orders.quote(fixture.shopId, fixture.baristaId, request), ConflictException);
  });

  it("blocks new self-orders after trial expiry while preserving original retries and status", async () => {
    const sql = fixture.database.connection;
    await sql`insert into shop_subscriptions(shop_id,plan,trial_started_at,trial_ends_at)
      values(${fixture.shopId},'basic',now()-interval '15 days',now()-interval '1 day')
      on conflict(shop_id) do update set trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,paid_until=null`;
    await assert.rejects(service.submit(fixture.shopId, { ...input(), clientKey: randomUUID(), statusToken: randomBytes(32).toString("hex") }), ForbiddenException);
    assert.equal((await service.submit(fixture.shopId, input())).id, id);
    assert.equal((await service.status(fixture.shopId, token)).status, "completed");
  });

});
