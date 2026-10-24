import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";
import { OrdersService } from "../src/orders.service.js";
describe("checkout expiry and refund snapshots",{skip:!process.env.TEST_DATABASE_URL},()=>{
 let f:PaymentSettingsFixture;let service:OrdersService;let memberId:string;let productId:string;
 before(async()=>{f=await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL??"");service=new OrdersService(f.database as never);
  const sql=f.database.connection;const [m]=await sql`insert into members(shop_id,display_name) values(${f.shopId},'Expiry member') returning id`;memberId=m.id;
  const [p]=await sql`insert into products(shop_id,name,base_price_satang,earns_stamp) values(${f.shopId},'Coffee',6500,true) returning id`;productId=p.id;
  const {ShiftsService}=await import("../src/shifts.service.js");await new ShiftsService(f.database as never).open(f.shopId,f.ownerId,{requestId:randomUUID(),openingFloatSatang:0});
 });after(async()=>{await f?.dispose();});
 it("rejects an expired reward even when no member page has been opened",async()=>{
  const [r]=await f.database.connection`insert into rewards(shop_id,member_id,status,expires_at) values(${f.shopId},${memberId},'available',now()-interval '1 second') returning id`;
  await assert.rejects(service.checkout(f.shopId,f.ownerId,{requestId:randomUUID(),memberId,redeemRewardId:r.id,lines:[{productId,qty:1,modifierIds:[]}],payment:{method:'cash',cashReceivedSatang:6500}}),BadRequestException);
 });
 it("saves earning deadlines and immutable per-line paid/stamp refund snapshots",async()=>{
  const result=await service.checkout(f.shopId,f.ownerId,{requestId:randomUUID(),memberId,lines:[{productId,qty:2,modifierIds:[]}],payment:{method:'cash',cashReceivedSatang:13000}});
  const [item]=await f.database.connection`select paid_satang,stamps_earned from order_items where order_id=${result.orderId}`;
  assert.deepEqual(item,{paid_satang:13000,stamps_earned:2});
  const [entry]=await f.database.connection`select expires_at > created_at as future from stamp_ledger where order_id=${result.orderId} and reason='earn'`;
  assert.equal(entry.future,true);
 });
});
