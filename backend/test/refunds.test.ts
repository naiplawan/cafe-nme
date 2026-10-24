import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before,after,describe,it } from "node:test";
import { ForbiddenException,ConflictException } from "@nestjs/common";
import { RefundsService } from "../src/refunds.service.js";
import { ShiftsService } from "../src/shifts.service.js";
import { ReportsService } from "../src/reports.service.js";
import { createPaymentSettingsFixture,type PaymentSettingsFixture } from "./payment-settings-fixture.js";
describe("partial refunds",{skip:!process.env.TEST_DATABASE_URL},()=>{
 let f:PaymentSettingsFixture;let service:RefundsService;let orderId:string;let itemId:string;
 before(async()=>{f=await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL??"");service=new RefundsService(f.database as never);const sql=f.database.connection;
 const [o]=await sql`insert into orders(shop_id,daily_no,business_date,status,total_satang) values(${f.shopId},1,'2026-10-23','paid',10000) returning id`;orderId=o.id;
 const [i]=await sql`insert into order_items(order_id,name_snapshot,unit_price_satang,qty,paid_satang,stamps_earned) values(${o.id},'Coffee',4000,3,10000,0) returning id`;itemId=i.id;
 await sql`insert into payments(order_id,method,amount_satang,confirmed_by) values(${o.id},'cash',10000,${f.ownerId})`;
 });after(async()=>{await f?.dispose();});
 it("requires same-shop manager approval",async()=>{
 for(const actor of [f.baristaId,f.otherShopOwnerId,f.inactiveOwnerId]) { await assert.rejects(service.create(f.shopId,actor,orderId,{requestId:randomUUID(),reason:'Return',lines:[{itemId,qty:1}]}),ForbiddenException); }
 });
 it("records one partial refund on retries and separates payout from approval",async()=>{
 const input={requestId:randomUUID(),reason:'One cup returned',lines:[{itemId,qty:1}]};
 const [a,b]=await Promise.all([service.create(f.shopId,f.managerId,orderId,input),service.create(f.shopId,f.managerId,orderId,input)]);
 assert.equal(a.amountSatang,3333);assert.deepEqual(a,b);
 const [r]=await f.database.connection`select paid_at,paid_by from refunds where id=${a.id}`;assert.deepEqual(r,{paid_at:null,paid_by:null});
 const reports=new ReportsService(f.database as never);
 const approved=await reports.refundSummary(f.shopId,{from:'2026-10-24',to:'2026-10-24'});
 assert.equal(approved.approvedSatang,3333);assert.equal(approved.paidSatang,0);assert.equal(approved.unpaidApprovedSatang,3333);
 const shifts=new ShiftsService(f.database as never);const shift=await shifts.open(f.shopId,f.ownerId,{requestId:randomUUID(),openingFloatSatang:10000});
 await service.payout(f.shopId,f.managerId,a.id,'cash','drawer payout');await service.payout(f.shopId,f.managerId,a.id,'cash','drawer payout');
 const payoutSummary=await reports.refundSummary(f.shopId,{from:'2026-10-24',to:'2026-10-24'});
 assert.equal(payoutSummary.paidSatang,3333);assert.equal(payoutSummary.cashPaidSatang,3333);assert.equal(payoutSummary.promptpayPaidSatang,0);
 const [paid]=await f.database.connection`select cash_shift_id,paid_at is not null as paid from refunds where id=${a.id}`;assert.equal(paid.cash_shift_id,shift.id);assert.equal(paid.paid,true);
 const summary=await shifts.list(f.shopId,f.ownerId);assert.equal(summary.shifts[0].expectedCashSatang,6667);
 await assert.rejects(service.payout(f.shopId,f.managerId,a.id,'promptpay','changed'),ConflictException);
 });
 it("prevents concurrent refunds exceeding sold quantity and paid amount",async()=>{
 const result=await Promise.allSettled([1,2].map(()=>service.create(f.shopId,f.ownerId,orderId,{requestId:randomUUID(),reason:'Remaining',lines:[{itemId,qty:2}]})));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 const [total]=await f.database.connection`select sum(amount_satang)::int as amount from refunds where order_id=${orderId}`;assert.equal(total.amount,10000);
 });
});
