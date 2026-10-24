import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { after, before, describe, it } from "node:test";
import { PreparationService } from "../src/preparation.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("preparation queue", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: PreparationService;
  let orderId: string;
  let itemId: string;
  let oldId: string;
  let foreignId: string;
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL ?? "");
    service = new PreparationService(fixture.database as never);
    const sql = fixture.database.connection;
    const [order] = await sql`insert into orders (shop_id,daily_no,business_date,status) values
      (${fixture.shopId},2,to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD'),'paid') returning id`;
    orderId = order.id;
    const [item] = await sql`insert into order_items (order_id,name_snapshot,unit_price_satang,qty,note)
      values (${orderId},'Iced coffee',6500,2,'No ice') returning id`;
    itemId = item.id;
    await sql`insert into order_item_modifiers (order_item_id,name_snapshot,price_delta_satang) values (${itemId},'Oat milk',1500)`;
    await sql`insert into orders (shop_id,daily_no,business_date,status) values
      (${fixture.shopId},1,to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD'),'paid'),
      (${fixture.shopId},3,to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD'),'void'),
      (${fixture.shopId},4,to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD'),'open')`;
    const [old] = await sql`insert into orders (shop_id,daily_no,business_date,status)
      values (${fixture.shopId},1,'2000-01-01','paid') returning id`;
    oldId = old.id;
    const [foreign] = await sql`insert into orders (shop_id,daily_no,business_date,status)
      select shop_id,1,to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD'),'paid'
      from staff where id=${fixture.otherShopOwnerId} returning id`;
    foreignId = foreign.id;
  });
  after(async () => { await fixture?.dispose(); });
  it("lists today's paid bills in queue-number order with immutable recipe snapshots", async () => {
    const rows = await service.list(fixture.shopId, fixture.baristaId);
    assert.deepEqual(rows.map((row) => row.dailyNo), [1, 2]);
    assert.deepEqual(rows[1], { id: orderId, dailyNo: 2, status: "received", updatedAt: null,
      items: [{ id: itemId, name: "Iced coffee", qty: 2, note: "No ice", modifiers: ["Oat milk"] }] });
  });
  it("denies inactive and foreign-shop actors on every read and mutation", async () => {
    for (const actor of [fixture.inactiveOwnerId, fixture.otherShopOwnerId]) {
      await assert.rejects(service.list(fixture.shopId, actor), ForbiddenException);
      await assert.rejects(service.transition(fixture.shopId, actor, orderId, "received", "preparing"), ForbiddenException);
    }
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, randomUUID(), "received", "preparing"), NotFoundException);
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, oldId, "received", "preparing"), NotFoundException);
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, foreignId, "received", "preparing"), NotFoundException);
  });
  it("rejects invalid jumps without changing received state", async () => {
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, orderId, "received", "ready"), BadRequestException);
    assert.equal((await service.list(fixture.shopId, fixture.baristaId))[1].status, "received");
  });
  it("serializes concurrent starts and makes the same desired-state retry idempotent", async () => {
    const results = await Promise.all([
      service.transition(fixture.shopId, fixture.baristaId, orderId, "received", "preparing"),
      service.transition(fixture.shopId, fixture.managerId, orderId, "received", "preparing"),
    ]);
    assert.equal(results[0].status, "preparing");
    assert.deepEqual(results[1], results[0]);
    assert.notEqual(results[0].updatedAt, null);
  });
  it("keeps ready cards visible and rejects stale requests after further progress", async () => {
    const ready = await service.transition(fixture.shopId, fixture.baristaId, orderId, "preparing", "ready");
    assert.equal(ready.status, "ready");
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, orderId, "received", "preparing"), ConflictException);
    assert.equal((await service.list(fixture.shopId, fixture.baristaId))[1].status, "ready");
  });
  it("cannot update a bill after it is voided", async () => {
    await fixture.database.connection`update orders set status='void' where id=${orderId}`;
    await assert.rejects(service.transition(fixture.shopId, fixture.baristaId, orderId, "preparing", "ready"), NotFoundException);
    assert.equal((await service.list(fixture.shopId, fixture.baristaId)).length, 1);
  });
});
