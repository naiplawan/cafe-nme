import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { after, before, describe, it } from "node:test";
import { TrialCheckoutService } from "../src/trial-checkout.service.js";
import { AdminDataService } from "../src/admin-data.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("setup trial checkout", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let trial: TrialCheckoutService;
  let dashboard: AdminDataService;
  let productId: string;
  const input = () => ({ lines: [{ productId, qty: 2, modifierIds: [] }], method: "cash" as const });
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL ?? "");
    trial = new TrialCheckoutService(fixture.database as never);
    dashboard = new AdminDataService(fixture.database as never);
    const sql = fixture.database.connection;
    const [product] = await sql`insert into products(shop_id,name,base_price_satang) values(${fixture.shopId},'Trial Coffee',5000) returning id`;
    productId = product.id;
    const [ingredient] = await sql`insert into ingredients(shop_id,name,unit) values(${fixture.shopId},'Trial beans','g') returning id`;
    await sql`insert into recipe_lines(shop_id,product_id,ingredient_id,quantity_milliunits) values(${fixture.shopId},${productId},${ingredient.id},18000)`;
    await sql`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,request_id)
      values(${fixture.shopId},${ingredient.id},'receive',100000,${fixture.ownerId},'Fixture delivery',${randomUUID()})`;
  });
  after(async () => { await fixture?.dispose(); });
  async function counts() {
    const [row] = await fixture.database.connection`select
      (select count(*)::int from orders where shop_id=${fixture.shopId}) as orders,
      (select count(*)::int from payments p join orders o on p.order_id=o.id where o.shop_id=${fixture.shopId}) as payments,
      (select count(*)::int from stamp_ledger where shop_id=${fixture.shopId}) as stamps,
      (select count(*)::int from rewards where shop_id=${fixture.shopId}) as rewards,
      (select count(*)::int from inventory_movements where shop_id=${fixture.shopId}) as movements,
      (select sum(quantity_milliunits)::text from inventory_movements where shop_id=${fixture.shopId}) as stock`;
    return row;
  }
  it("denies baristas, inactive staff and other-shop actors without marking setup complete", async () => {
    for (const actor of [fixture.baristaId, fixture.inactiveOwnerId, fixture.otherShopOwnerId]) {
      await assert.rejects(trial.run(fixture.shopId, actor, input()), ForbiddenException);
    }
    assert.equal((await dashboard.dashboard(fixture.shopId) as { trialSetup?: boolean }).trialSetup ?? false, false);
  });
  it("runs the real checkout write path and leaves failed trials incomplete", async () => {
    const sql = fixture.database.connection;
    const name = `trial_probe_${randomUUID().replaceAll("-", "")}`;
    await sql.unsafe(`create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'trial checkout reached'; end $$`);
    await sql.unsafe(`create trigger ${name} before insert on orders for each row when (NEW.shop_id='${fixture.shopId}'::uuid) execute function ${name}()`);
    try { await assert.rejects(trial.run(fixture.shopId, fixture.ownerId, input()), /trial checkout reached/); }
    finally { await sql.unsafe(`drop trigger ${name} on orders`); await sql.unsafe(`drop function ${name}()`); }
    const [audit] = await sql`select count(*)::int as n from audit_log where shop_id=${fixture.shopId} and action='setup.trial-checkout'`;
    assert.equal(audit.n, 0);
  });
  it("rolls back sales, payments, rewards and stock while retaining only success audit", async () => {
    const before = await counts();
    const summary = await trial.run(fixture.shopId, fixture.managerId, input());
    assert.deepEqual(summary, { totalSatang: 10000, itemCount: 2, method: "cash" });
    assert.deepEqual(await counts(), before);
    const [audit] = await fixture.database.connection`select actor,payload from audit_log where shop_id=${fixture.shopId} and action='setup.trial-checkout'`;
    assert.deepEqual(audit, { actor: fixture.managerId, payload: { totalSatang: 10000, itemCount: 2, method: "cash" } });
    assert.equal((await dashboard.dashboard(fixture.shopId) as { trialSetup?: boolean }).trialSetup, true);
  });
  it("requires configured PromptPay and still rolls back a successful PromptPay trial", async () => {
    const before = await counts();
    await assert.rejects(trial.run(fixture.shopId, fixture.ownerId, { ...input(), method: "promptpay" }), BadRequestException);
    await fixture.database.connection`update shops set promptpay_id='0812345678' where id=${fixture.shopId}`;
    assert.equal((await trial.run(fixture.shopId, fixture.ownerId, { ...input(), method: "promptpay" })).method, "promptpay");
    assert.deepEqual(await counts(), before);
  });
});
