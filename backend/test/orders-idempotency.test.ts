import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import postgres from "postgres";
import type { DatabaseService } from "../src/database.service.js";
import { OrdersService } from "../src/orders.service.js";

describe("checkout retries", { skip: !process.env.TEST_DATABASE_URL }, () => {
  const sql = postgres(process.env.TEST_DATABASE_URL ?? "", { max: 5 });
  const shopId = randomUUID();
  const staffId = randomUUID();
  const productId = randomUUID();
  const memberId = randomUUID();
  const otherShopId = randomUUID();
  const otherStaffId = randomUUID();
  const otherProductId = randomUUID();
  const orders = new OrdersService({ connection: sql } as DatabaseService);

  before(async () => {
    await sql`insert into shops (id, name, slug, promptpay_id, stamp_goal) values (${shopId}, 'Retry test', ${shopId}, '0812345678', 3)`;
    await sql`insert into staff (id, shop_id, name, role) values (${staffId}, ${shopId}, 'Owner', 'owner')`;
    await sql`insert into products (id, shop_id, name, base_price_satang, earns_stamp) values (${productId}, ${shopId}, 'Coffee', 5000, true)`;
    await sql`insert into members (id, shop_id, display_name) values (${memberId}, ${shopId}, 'Member')`;
    await sql`insert into shops (id, name, slug, promptpay_id, stamp_goal) values (${otherShopId}, 'Other retry test', ${otherShopId}, '0812345678', 3)`;
    await sql`insert into staff (id, shop_id, name, role) values (${otherStaffId}, ${otherShopId}, 'Other owner', 'owner')`;
    await sql`insert into products (id, shop_id, name, base_price_satang, earns_stamp) values (${otherProductId}, ${otherShopId}, 'Other coffee', 7000, true)`;
  });

  after(async () => {
    await sql`delete from shops where id = ${shopId}`;
    await sql`delete from shops where id = ${otherShopId}`;
    await sql.end();
  });

  function input(requestId = randomUUID(), options: { productId?: string; memberId?: string | null; qty?: number } = {}) {
    return {
      requestId,
      memberId: options.memberId === undefined ? memberId : options.memberId,
      lines: [{ productId: options.productId ?? productId, qty: options.qty ?? 3, modifierIds: [] as string[] }],
      payment: { method: "promptpay" as const },
    };
  }

  it("records one order, payment and earned reward for concurrent identical submissions", async () => {
    const request = input();
    const [first, retry] = await Promise.all([orders.checkout(shopId, staffId, request), orders.checkout(shopId, staffId, request)]);
    assert.notEqual(first.replayed, retry.replayed);
    const committed = first.replayed ? retry : first;
    const replay = first.replayed ? first : retry;
    assert.equal(committed.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(committed.orderId, replay.orderId);
    assert.equal(committed.totalSatang, 15_000);
    assert.equal(replay.stampsEarned, committed.stampsEarned);
    assert.equal(replay.rewardsCreated, committed.rewardsCreated);
    const [counts] = await sql`
      select (select count(*)::int from payments where order_id = ${committed.orderId}) as payments,
        (select count(*)::int from rewards where earned_order_id = ${committed.orderId}) as rewards,
        (select count(*)::int from stamp_ledger where order_id = ${committed.orderId} and reason = 'earn') as earnings
    `;
    assert.deepEqual(counts, { payments: 1, rewards: 1, earnings: 1 });
  });

  it("serializes a same-key retry when UUID casing differs", async () => {
    const requestId = randomUUID();
    const request = input(requestId);
    const [first, retry] = await Promise.all([
      orders.checkout(shopId, staffId, request),
      orders.checkout(shopId.toUpperCase(), staffId.toUpperCase(), { ...request, requestId: requestId.toUpperCase() }),
    ]);
    assert.notEqual(first.replayed, retry.replayed);
    assert.equal(first.orderId, retry.orderId);
    const [count] = await sql<{ count: number | string }[]>`
      select count(*) as count from orders where shop_id = ${shopId}::uuid and checkout_key = ${requestId}::uuid
    `;
    assert.equal(Number(count.count), 1);
  });

  it("rejects a reused key with a different quantity", async () => {
    const request = input();
    await orders.checkout(shopId, staffId, request);
    await assert.rejects(orders.checkout(shopId, staffId, { ...request, lines: [{ ...request.lines[0], qty: 1 }] }), (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.deepEqual(error.getResponse(), { code: "idempotency_key_reused" });
      return true;
    });
  });

  it("scopes the same request key independently per shop", async () => {
    const requestId = randomUUID();
    const first = await orders.checkout(shopId, staffId, input(requestId));
    const other = await orders.checkout(otherShopId, otherStaffId, input(requestId, { productId: otherProductId, memberId: null, qty: 1 }));
    assert.notEqual(other.orderId, first.orderId);
    assert.equal(other.replayed, false);
  });

  it("replays committed totals after prices, availability, receiving settings and business date change", async () => {
    const request = input();
    const first = await orders.checkout(shopId, staffId, request);
    await sql`update products set base_price_satang = 9000, sold_out = true where id = ${productId}`;
    await sql`update shops set promptpay_id = null where id = ${shopId}`;
    await sql`update orders set business_date = '2000-01-01' where id = ${first.orderId}`;
    try {
      const retry = await orders.checkout(shopId, staffId, request);
      assert.equal(retry.orderId, first.orderId);
      assert.equal(retry.totalSatang, 15_000);
      assert.equal(retry.rewardsCreated, first.rewardsCreated);
    } finally {
      await sql`update products set base_price_satang = 5000, sold_out = false where id = ${productId}`;
      await sql`update shops set promptpay_id = '0812345678' where id = ${shopId}`;
    }
  });

  it("does not disclose a committed result to a subsequently inactive staff member", async () => {
    const request = input();
    await orders.checkout(shopId, staffId, request);
    await sql`update staff set is_active = false where id = ${staffId}`;
    try {
      await assert.rejects(orders.checkout(shopId, staffId, request), NotFoundException);
    } finally {
      await sql`update staff set is_active = true where id = ${staffId}`;
    }
  });

  it("does not disclose a committed result to staff from another shop", async () => {
    const request = input();
    await orders.checkout(shopId, staffId, request);
    await assert.rejects(
      orders.checkout(shopId, otherStaffId, request),
      NotFoundException,
    );
  });
});
