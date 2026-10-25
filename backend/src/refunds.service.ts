import { releaseRefundStock } from './inventory.service.js';
import { BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException } from "@nestjs/common";
import type { Sql,TransactionSql } from "postgres";
import { resolveSharedLoyalty, restoreOrderSharedStamps, reverseOrderEarnedStamps } from "./loyalty-groups.service.js";
import { DatabaseService } from "./database.service.js";
import { allocateLinePayments,refundQuantityAmount } from "./refund-domain.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface RefundInput { requestId:string;reason:string;lines:{itemId:string;qty:number}[] }
interface RefundLine { itemId:string;qty:number;amountSatang:number;stampsReversed:number }
@Injectable()
export class RefundsService {
 constructor(@Inject(DatabaseService) private readonly database:DatabaseService) {}
 private async manager(sql:Sql|TransactionSql,shopId:string,actor:string) {
  if (!UUID.test(shopId)||!UUID.test(actor)) { throw new BadRequestException("Invalid identifier"); }
  const [row]=await sql`select id from staff where shop_id=${shopId}::uuid and id=${actor}::uuid and is_active=true and role in ('owner','manager') for share`;
  if (!row) { throw new ForbiddenException("Shop manager required"); }
 }
 async detail(shopId:string,actor:string,orderId:string) {
  await this.manager(this.database.connection,shopId,actor);
  const [order]=await this.database.connection`select id::text,daily_no as "dailyNo",total_satang as "totalSatang",status from orders where shop_id=${shopId}::uuid and id=${orderId}::uuid`;
  if (!order) { throw new NotFoundException("Order not found"); }
  const items=await this.database.connection`select id::text,name_snapshot as name,qty,paid_satang as "paidSatang" from order_items where order_id=${orderId}::uuid order by line_no`;
  const refunds=await this.database.connection`select r.id::text,r.amount_satang as "amountSatang",r.lines,r.reason,s.name as "approvedBy",r.created_at::text as "createdAt",r.paid_at::text as "paidAt",r.payout_method as "payoutMethod",r.payout_reference as "payoutReference",payer.name as "paidBy" from refunds r join staff s on s.id=r.approved_by left join staff payer on payer.id=r.paid_by where r.shop_id=${shopId}::uuid and r.order_id=${orderId}::uuid order by r.created_at`;
  return {order,items,refunds};
 }
 async create(shopId:string,actor:string,orderId:string,input:RefundInput):Promise<{id:string;amountSatang:number}> {
  if (!UUID.test(orderId)||!UUID.test(input.requestId)||typeof input.reason!=="string"||!input.reason.trim()||input.reason.length>500||!Array.isArray(input.lines)||input.lines.length===0||input.lines.length>100||input.lines.some(l=>!UUID.test(l.itemId)||!Number.isInteger(l.qty)||l.qty<1||l.qty>99)||new Set(input.lines.map(l=>l.itemId)).size!==input.lines.length) { throw new BadRequestException("Invalid refund request"); }
  const lines=[...input.lines].sort((a,b)=>a.itemId.localeCompare(b.itemId));const reason=input.reason.trim();
  return this.database.connection.begin(async tx=>{
   await tx`select id from shops where id=${shopId}::uuid for share`;
   await this.manager(tx,shopId,actor);
   const [order]=await tx`select id,member_id,total_satang,status from orders where id=${orderId}::uuid and shop_id=${shopId}::uuid for update`;
   if (!order) { throw new NotFoundException("Order not found"); }
   await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:refund:${input.requestId}`},0))`;
   const [existing]=await tx`select id::text,order_id,approved_by,amount_satang,reason,lines from refunds where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
   if (existing) {
    if(existing.order_id!==orderId||existing.approved_by!==actor||existing.reason!==reason||JSON.stringify((existing.lines as RefundLine[]).map(({itemId,qty})=>({itemId,qty})))!==JSON.stringify(lines)) { throw new ConflictException("Refund key reused"); }
    return {id:existing.id as string,amountSatang:existing.amount_satang as number};
   }
   if(order.status!=="paid") { throw new ConflictException("Only paid bills can be refunded"); }
   const sold=await tx`select id::text,qty,unit_price_satang,paid_satang,stamps_earned,reward_discount_satang from order_items where order_id=${orderId}::uuid order by line_no,id`;
   const prior=await tx`select amount_satang,lines from refunds where shop_id=${shopId}::uuid and order_id=${orderId}::uuid`;
   const previous=prior.flatMap(row=>row.lines as RefundLine[]);
   const allocations=allocateLinePayments(sold.map(row=>row.unit_price_satang*row.qty),order.total_satang);
   const refundLines:RefundLine[]=lines.map(line=>{
    const index=sold.findIndex(row=>row.id===line.itemId);const item=sold[index];
    if(!item) { throw new NotFoundException("Order item not found"); }
    const refundedQty=previous.filter(row=>row.itemId===line.itemId).reduce((sum,row)=>sum+row.qty,0);
    if(refundedQty+line.qty>item.qty) { throw new ConflictException("Quantity already refunded"); }
    if(order.member_id&&item.stamps_earned===null) { throw new ConflictException("Legacy member bill has no stamp snapshot; manual review required"); }
    // For new bills, the reward unit is refunded first; only its paid add-ons return as money.
    const amountSatang = item.reward_discount_satang === null
      ? refundQuantityAmount(item.paid_satang??allocations[index],item.qty,refundedQty,line.qty)
      : item.unit_price_satang * line.qty - (refundedQty === 0 ? item.reward_discount_satang : 0);
    const previousStamps = previous.filter(row=>row.itemId===line.itemId).reduce((sum,row)=>sum+row.stampsReversed,0);
    const unpaidUnits = item.reward_discount_satang > 0 && refundedQty === 0 ? 1 : 0;
    const stampsReversed = Math.min(Math.max(0,(item.stamps_earned ?? 0)-previousStamps),line.qty-unpaidUnits);
    return {...line,amountSatang,stampsReversed};
   });
   const amountSatang=refundLines.reduce((sum,line)=>sum+line.amountSatang,0);
   if(amountSatang+prior.reduce((sum,row)=>sum+row.amount_satang,0)>order.total_satang) { throw new ConflictException("Refund exceeds amount paid"); }
   // Loyalty reversal is implemented with the shared-loyalty transaction helpers.
   if (order.member_id) {
    let scope=await resolveSharedLoyalty(tx,shopId,order.member_id);
    if(!scope) { throw new ConflictException("Member not available for refund"); }
    const requested=refundLines.reduce((sum,line)=>sum+line.stampsReversed,0);
    const previousReversed=previous.reduce((sum,line)=>sum+line.stampsReversed,0);
    const [earned]=await tx`select coalesce(sum(delta),0)::int as amount from stamp_ledger where shop_id=${shopId}::uuid and member_id=${order.member_id}::uuid
      and order_id=${orderId}::uuid and reason='earn' and (expires_at is null or expires_at>${scope.asOf})`;
    const reverse=Math.min(requested,Math.max(0,earned.amount-previousReversed));
    const needed=Math.max(0,reverse-scope.stampBalance);
    if(needed>0) {
      const rewards=await tx<{id:string}[]>`select id::text as id from rewards where shop_id=${shopId}::uuid and member_id=${order.member_id}::uuid
        and earned_order_id=${orderId}::uuid and status='available' order by created_at,id limit ${Math.ceil(needed/scope.stampGoal)} for update`;
      if(rewards.length) {
        await tx`update rewards set status='expired' where id=any(${rewards.map(row=>row.id)}::uuid[])`;
        await restoreOrderSharedStamps(tx,scope,orderId,actor,`refund:${input.requestId}`,rewards.length*scope.stampGoal);
        scope=await resolveSharedLoyalty(tx,shopId,order.member_id,scope.asOf);
        if(!scope) { throw new ConflictException("Member not available for refund"); }
      }
    }
    await reverseOrderEarnedStamps(tx,scope,orderId,actor,requested,previousReversed);
    const refundedQty=previous.reduce((sum,line)=>sum+line.qty,0)+refundLines.reduce((sum,line)=>sum+line.qty,0);
    if(refundedQty===sold.reduce((sum,item)=>sum+item.qty,0)) {
      await tx`update rewards set status=case when expires_at<=${scope.asOf} then 'expired'::reward_status else 'available'::reward_status end,redeemed_order_id=null
        where redeemed_order_id=${orderId}::uuid and member_id=any(${scope.aliases.map(alias=>alias.memberId)}::uuid[]) and status='redeemed'`;
    }
   }
   const [refund]=await tx`insert into refunds(shop_id,order_id,request_id,amount_satang,lines,reason,approved_by) values(${shopId},${orderId},${input.requestId},${amountSatang},${tx.json(refundLines.map(line=>({...line})))},${reason},${actor}) returning id::text`;
   await releaseRefundStock(tx,shopId,orderId);
   return {id:refund.id as string,amountSatang};
  });
 }
 async payout(shopId:string,actor:string,refundId:string,method:"cash"|"promptpay",reference:string):Promise<{success:true}> {
  if(!UUID.test(refundId)||!["cash","promptpay"].includes(method)||typeof reference!=="string"||!reference.trim()||reference.length>200) { throw new BadRequestException("Payout method and reference required"); }
  return this.database.connection.begin(async tx=>{
   await tx`select id from shops where id=${shopId}::uuid for update`;
   await this.manager(tx,shopId,actor);
   const [refund]=await tx`select * from refunds where shop_id=${shopId}::uuid and id=${refundId}::uuid for update`;
   if(!refund) { throw new NotFoundException("Refund not found"); }
   if(refund.paid_at) {
    if(refund.payout_method!==method||refund.payout_reference!==reference.trim()) { throw new ConflictException("Refund already paid"); }
    return {success:true as const};
   }
   let shiftId:string|null=null;
   if(method==='cash') {
    const [shift]=await tx`select id from shifts where shop_id=${shopId}::uuid and closed_at is null`;
    if(!shift) { throw new ConflictException("Open a cash shift before recording cash payout"); }shiftId=shift.id;
   }
   await tx`update refunds set paid_at=clock_timestamp(),paid_by=${actor}::uuid,payout_method=${method},payout_reference=${reference.trim()},cash_shift_id=${shiftId}::uuid where id=${refundId}::uuid`;
   return {success:true as const};
  });
 }
}
