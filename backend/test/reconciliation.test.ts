import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { after, before, describe, it } from "node:test";
import { ReconciliationService } from "../src/reconciliation.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("payment reconciliation", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: ReconciliationService;
  let paymentId: string;
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    service = new ReconciliationService(fixture.database as never);
    const sql = fixture.database.connection;
    const [order] = await sql`insert into orders (shop_id,daily_no,business_date,status,total_satang)
      values (${fixture.shopId},1,'2026-10-23','paid',6500) returning id`;
    const [payment] = await sql`insert into payments (order_id,method,amount_satang,confirmed_by)
      values (${order.id},'promptpay',6500,${fixture.baristaId}) returning id`;
    paymentId = payment.id;
  });
  after(async () => { await fixture?.dispose(); });

  it("keeps cashier-recorded PromptPay pending review without claiming bank confirmation", async () => {
    const rows = await service.list(fixture.shopId, fixture.ownerId, "2026-10-23");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      paymentId, dailyNo: 1, method: "promptpay", expectedSatang: 6500,
      observedSatang: null, differenceSatang: null, status: "pending",
      recordedBy: "Payment settings barista", reviewedBy: null, reviewedAt: null,
      source: null, note: null,
    });
  });

  it("denies barista, inactive and foreign-shop actors for reads and writes", async () => {
    for (const actor of [fixture.baristaId, fixture.inactiveOwnerId, fixture.otherShopOwnerId]) {
      await assert.rejects(service.list(fixture.shopId, actor, "2026-10-23"), ForbiddenException);
      await assert.rejects(service.review(fixture.shopId, actor, paymentId,
        { requestId: randomUUID(), observedSatang: 6500, note: "" }), ForbiddenException);
    }
    await assert.rejects(service.review(fixture.shopId, fixture.ownerId, randomUUID(),
      { requestId: randomUUID(), observedSatang: 6500, note: "" }), NotFoundException);
  });

  it("validates money and requires a reason for differences before writing", async () => {
    for (const amount of [-1, 0.5, Number.MAX_SAFE_INTEGER]) {
      await assert.rejects(service.review(fixture.shopId, fixture.ownerId, paymentId,
        { requestId: randomUUID(), observedSatang: amount, note: "count" }), BadRequestException);
    }
    await assert.rejects(service.review(fixture.shopId, fixture.ownerId, paymentId,
      { requestId: randomUUID(), observedSatang: 6000, note: " " }), BadRequestException);
    await assert.rejects(service.list(fixture.shopId, fixture.ownerId, "2026-02-30"), BadRequestException);
  });

  it("records manual discrepancies, rechecks append history, and deduplicates retries", async () => {
    const input = { requestId: randomUUID(), observedSatang: 6000, note: "Transfer short" };
    const first = await service.review(fixture.shopId, fixture.managerId, paymentId, input);
    assert.notEqual(first.id, "");
    assert.deepEqual(await service.review(fixture.shopId, fixture.managerId, paymentId, input), first);
    const [row] = await service.list(fixture.shopId, fixture.ownerId, "2026-10-23") as Record<string, unknown>[];
    assert.equal(row.status, "discrepancy");
    assert.equal(row.differenceSatang, -500);
    assert.equal(row.source, "staff");
    assert.equal(row.reviewedBy, "Payment settings manager");
    await assert.rejects(service.review(fixture.shopId, fixture.managerId, paymentId,
      { ...input, observedSatang: 6500 }), ConflictException);
    await service.review(fixture.shopId, fixture.ownerId, paymentId,
      { requestId: randomUUID(), observedSatang: 6500, note: "Remaining transfer received" });
    const [updated] = await service.list(fixture.shopId, fixture.ownerId, "2026-10-23") as Record<string, unknown>[];
    assert.equal(updated.status, "matched");
    const [count] = await fixture.database.connection`select count(*)::int as n from payment_reviews where payment_id=${paymentId}`;
    assert.equal(count.n, 2);
  });

  it("excludes voided bills and prevents reviewing them", async () => {
    await fixture.database.connection`update orders set status='void' where shop_id=${fixture.shopId}`;
    assert.equal((await service.list(fixture.shopId, fixture.ownerId, "2026-10-23")).length, 0);
    await assert.rejects(service.review(fixture.shopId, fixture.ownerId, paymentId,
      { requestId: randomUUID(), observedSatang: 6500, note: "" }), ConflictException);
  });
});
