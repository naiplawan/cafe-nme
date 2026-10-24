import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {before,after,test} from "node:test";
import { OrdersService } from "../src/orders.service.js";
import { createPaymentSettingsFixture,type PaymentSettingsFixture } from "./payment-settings-fixture.js";
let f:PaymentSettingsFixture;
before(async()=>{if(process.env.TEST_DATABASE_URL) {f=await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL);}});
after(async()=>{await f?.dispose();});
test("actual checkout consumes recipe exactly once across same-key retries",{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const sql=f.database.connection;
 const [p]=await sql`insert into products(shop_id,name,base_price_satang) values(${f.shopId},'Latte',6500) returning id`;
 const [milk]=await sql`insert into ingredients(shop_id,name,unit) values(${f.shopId},'Milk','ml') returning id`;
 await sql`insert into recipe_lines(shop_id,product_id,ingredient_id,quantity_milliunits) values(${f.shopId},${p.id},${milk.id},200000)`;
 const orders=new OrdersService(f.database as never);
 const input={requestId:randomUUID(),lines:[{productId:p.id,qty:2,modifierIds:[]}],payment:{method:'cash' as const,cashReceivedSatang:13000}};
 const [a,b]=await Promise.all([orders.checkout(f.shopId,f.ownerId,input),orders.checkout(f.shopId,f.ownerId,input)]);assert.equal(a.orderId,b.orderId);
 const rows=await sql`select quantity_milliunits::int as qty from inventory_movements where order_id=${a.orderId}`;
 assert.equal(rows.length,1);assert.equal(rows[0].qty,-400000);
});
