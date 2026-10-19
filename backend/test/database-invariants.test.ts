import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import postgres from "postgres";

const databaseUrl = process.env.TEST_DATABASE_URL;
const database = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;

after(async () => {
  await database?.end();
});

test("database rejects invalid stamp goals, prices, modifier bounds, and order lines", { skip: !database }, async () => {
  assert.ok(database);
  const shopId = randomUUID();
  const productId = randomUUID();
  const orderId = randomUUID();

  await database`insert into shops (id, name, slug, stamp_goal) values (${shopId}, 'Invariant test', ${`invariant-${shopId}`}, 10)`;
  await database`insert into products (id, shop_id, name, base_price_satang) values (${productId}, ${shopId}, 'Coffee', 5000)`;
  await database`insert into orders (id, shop_id, daily_no, business_date, subtotal_satang, discount_satang, total_satang)
    values (${orderId}, ${shopId}, 1, '2026-10-19', 5000, 0, 5000)`;

  try {
    await assert.rejects(database`update shops set stamp_goal = 0 where id = ${shopId}`);
    await assert.rejects(database`update products set base_price_satang = -1 where id = ${productId}`);
    await assert.rejects(database`insert into modifier_groups (shop_id, name, min_select, max_select)
      values (${shopId}, 'Invalid group', 2, 1)`);
    await assert.rejects(database`insert into order_items (order_id, product_id, name_snapshot, unit_price_satang, qty)
      values (${orderId}, ${productId}, 'Zero qty', 5000, 0)`);
    await assert.rejects(database`insert into order_items (order_id, product_id, name_snapshot, unit_price_satang, qty)
      values (${orderId}, ${productId}, 'Negative price', -1, 1)`);

    await database`insert into order_items (order_id, product_id, name_snapshot, unit_price_satang, qty)
      values (${orderId}, ${productId}, 'Valid item', 0, 1)`;
  } finally {
    await database`delete from shops where id = ${shopId}`;
  }
});
