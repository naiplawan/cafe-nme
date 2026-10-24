import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CatalogService } from "../src/catalog.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL is required for public menu catalog integration";
let fixture: PaymentSettingsFixture;
let catalog: CatalogService;
before(async () => {
  if (!databaseUrl) { return; }
  fixture = await createPaymentSettingsFixture(databaseUrl);
  catalog = new CatalogService(fixture.database as never);
  const sql = fixture.database.connection;
  await sql`insert into products (shop_id, name, base_price_satang, is_active, sold_out, sold_out_on)
    values (${fixture.shopId}::uuid, 'Visible coffee', 6550, true, false, null),
      (${fixture.shopId}::uuid, 'Hidden coffee', 9000, false, false, null),
      (${fixture.shopId}::uuid, 'Yesterday sold out', 7000, true, true, '2000-01-01'),
      (${fixture.shopId}::uuid, 'Today sold out', 7500, true, true,
        (select to_char(now() at time zone timezone, 'YYYY-MM-DD') from shops where id = ${fixture.shopId}::uuid))`;
  await sql`insert into products (shop_id, name, base_price_satang)
    select shop_id, 'Other shop secret menu', 9900 from staff where id = ${fixture.otherShopOwnerId}::uuid`;
});
after(async () => { await fixture?.dispose(); });

test("public catalog excludes hidden and other-shop products while keeping price", { skip }, async () => {
  const menu = await catalog.getPosMenu(fixture.shopId);
  assert.deepEqual(menu.products.map((product) => product.name).sort((a, b) => a.localeCompare(b)), ["Today sold out", "Visible coffee", "Yesterday sold out"]);
  assert.equal(menu.products.find((product) => product.name === "Visible coffee")?.basePriceSatang, 6550);
});
test("public catalog uses effective sold-out status after the business-day rollover", { skip }, async () => {
  const menu = await catalog.getPosMenu(fixture.shopId);
  assert.equal(menu.products.find((product) => product.name === "Yesterday sold out")?.soldOut, false);
  assert.equal(menu.products.find((product) => product.name === "Today sold out")?.soldOut, true);
});
test("public catalog preserves sold-out status when auto-clear is disabled", { skip }, async () => {
  const sql = fixture.database.connection;
  await sql`update shops set auto_clear_sold_out = false where id = ${fixture.shopId}::uuid`;
  await sql`update products set sold_out = true, sold_out_on = '2000-01-01'
    where shop_id = ${fixture.shopId}::uuid and name = 'Yesterday sold out'`;
  const menu = await catalog.getPosMenu(fixture.shopId);
  assert.equal(menu.products.find((product) => product.name === "Yesterday sold out")?.soldOut, true);
});
