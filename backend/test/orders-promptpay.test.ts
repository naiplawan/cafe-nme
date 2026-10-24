import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { BadRequestException } from "@nestjs/common";
import postgres, { type Sql } from "postgres";
import type { DatabaseService } from "../src/database.service.js";
import { type CheckoutInput, OrdersService } from "../src/orders.service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const database = databaseUrl ? postgres(databaseUrl, { prepare: false, max: 5 }) : null;
const orders = database
  ? new OrdersService({ connection: database } as unknown as DatabaseService)
  : null;
const skipWithoutDatabase = !databaseUrl;

let shopId: string;
let staffId: string;
let productId: string;
let memberId: string;

async function counts(sql: Sql) {
  const [row] = await sql<{
    orders: number | string;
    payments: number | string;
    stamps: number | string;
    rewards: number | string;
  }[]>`
    select
      (select count(*) from orders where shop_id = ${shopId}::uuid) as orders,
      (select count(*) from payments p join orders o on o.id = p.order_id where o.shop_id = ${shopId}::uuid) as payments,
      (select count(*) from stamp_ledger where shop_id = ${shopId}::uuid) as stamps,
      (select count(*) from rewards where shop_id = ${shopId}::uuid) as rewards
  `;
  return {
    orders: Number(row.orders),
    payments: Number(row.payments),
    stamps: Number(row.stamps),
    rewards: Number(row.rewards),
  };
}

function checkoutInput(payment: CheckoutInput["payment"], member?: string): CheckoutInput {
  return {
    lines: [{ productId, qty: 1, modifierIds: [] }],
    ...(member ? { memberId: member } : {}),
    payment,
  };
}

function checkoutCode(error: unknown): string | null {
  if (!(error instanceof BadRequestException)) {
    return null;
  }
  const response = error.getResponse();
  return response && typeof response === "object" && "code" in response && typeof response.code === "string"
    ? response.code
    : null;
}

before(async () => {
  if (!database) {
    return;
  }
  const [shop] = await database`
    insert into shops (name, slug, timezone, promptpay_id, stamp_goal)
    values ('PromptPay checkout test', ${`promptpay-test-${randomUUID()}`}, 'Asia/Bangkok', null, 1)
    returning id::text as id
  `;
  shopId = shop.id;
  const [staff] = await database`
    insert into staff (shop_id, name, role, is_active)
    values (${shopId}::uuid, 'Checkout tester', 'barista', true)
    returning id::text as id
  `;
  staffId = staff.id;
  await database`insert into shifts (shop_id, opened_by, opening_request_id, opening_float_satang)
    values (${shopId}::uuid, ${staffId}::uuid, ${randomUUID()}::uuid, 0)`;
  const [product] = await database`
    insert into products (shop_id, name, base_price_satang, is_active, earns_stamp, sold_out)
    values (${shopId}::uuid, 'Test coffee', 5000, true, true, false)
    returning id::text as id
  `;
  productId = product.id;
  const [member] = await database`
    insert into members (shop_id, display_name, phone)
    values (${shopId}::uuid, 'Loyalty tester', ${`08${Date.now().toString().slice(-8)}`})
    returning id::text as id
  `;
  memberId = member.id;
});

after(async () => {
  if (!database) {
    return;
  }
  if (shopId) {
    await database`delete from shops where id = ${shopId}::uuid`;
  }
  await database.end();
});

test("unconfigured PromptPay rejects before writes while cash and configured PromptPay checkout succeed", { skip: skipWithoutDatabase }, async () => {
  assert.ok(database);
  assert.ok(orders);
  const beforeCounts = await counts(database);

  await assert.rejects(
    orders.checkout(shopId, staffId, checkoutInput({ method: "promptpay" }, memberId)),
    (error: unknown) => {
      assert.equal(checkoutCode(error), "promptpay_not_configured");
      return true;
    },
  );
  assert.deepEqual(await counts(database), beforeCounts);

  const cash = await orders.checkout(shopId, staffId, checkoutInput({ method: "cash", cashReceivedSatang: 5000 }));
  assert.equal(cash.totalSatang, 5000);
  assert.equal(cash.changeSatang, 0);

  await database`update shops set promptpay_id = '0812345678' where id = ${shopId}::uuid`;
  const promptpay = await orders.checkout(shopId, staffId, checkoutInput({ method: "promptpay" }));
  assert.equal(promptpay.totalSatang, 5000);

  const [payment] = await database<{ method: string }[]>`
    select p.method from payments p join orders o on o.id = p.order_id
    where o.id = ${promptpay.orderId}::uuid
  `;
  assert.equal(payment.method, "promptpay");
});

test("PromptPay configuration disable serializes ahead of checkout's shop lock", { skip: skipWithoutDatabase }, async () => {
  assert.ok(database);
  assert.ok(orders);
  await database`update shops set promptpay_id = '0812345678' where id = ${shopId}::uuid`;

  let release!: () => void;
  let lockAcquired!: () => void;
  const releaseLock = new Promise<void>((resolve) => { release = resolve; });
  const lockReady = new Promise<void>((resolve) => { lockAcquired = resolve; });
  const disable = database.begin(async (tx) => {
    await tx`select id from shops where id = ${shopId}::uuid for update`;
    lockAcquired();
    await releaseLock;
    await tx`update shops set promptpay_id = null where id = ${shopId}::uuid`;
  });

  await lockReady;
  const checkout = orders.checkout(shopId, staffId, checkoutInput({ method: "promptpay" }));
  await new Promise((resolve) => setTimeout(resolve, 25));
  release();

  await disable;
  await assert.rejects(
    checkout,
    (error: unknown) => {
      assert.equal(checkoutCode(error), "promptpay_not_configured");
      return true;
    },
  );
  assert.deepEqual(await counts(database), { orders: 2, payments: 2, stamps: 0, rewards: 0 });
});
