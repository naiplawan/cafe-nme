import "server-only";
import { z } from "zod";
import { internalApiFetch } from "./internal-api";
const line=z.object({itemId:z.uuid(),qty:z.number().int(),amountSatang:z.number().int(),stampsReversed:z.number().int()});
const detail=z.object({order:z.object({id:z.uuid(),dailyNo:z.number().int(),totalSatang:z.number().int(),status:z.string()}),items:z.array(z.object({id:z.uuid(),name:z.string(),qty:z.number().int(),paidSatang:z.number().int().nullable()})),refunds:z.array(z.object({id:z.uuid(),amountSatang:z.number().int(),lines:z.array(line),reason:z.string(),approvedBy:z.string(),createdAt:z.string(),paidAt:z.string().nullable(),paidBy:z.string().nullable(),payoutMethod:z.string().nullable(),payoutReference:z.string().nullable()}))});
export type RefundDetail=z.infer<typeof detail>;
async function request(shop:string,path:string,init:RequestInit={}) {
 const response=await internalApiFetch(`/v1/shops/${encodeURIComponent(shop)}/${path}`,init);
 if(!response.ok) { throw new Error(`Refund API returned ${response.status}`); }return response.json();
}
export async function getRefundDetail(shop:string,actor:string,order:string) { return detail.parse(await request(shop,`orders/${encodeURIComponent(order)}/refunds?actorStaffId=${encodeURIComponent(actor)}`)); }
export async function createRefund(shop:string,actor:string,order:string,input:{requestId:string;reason:string;lines:{itemId:string;qty:number}[]}) { return z.object({id:z.uuid(),amountSatang:z.number().int()}).parse(await request(shop,`orders/${encodeURIComponent(order)}/refunds`,{method:"POST",body:JSON.stringify({...input,actorStaffId:actor})})); }
export async function recordRefundPayout(shop:string,actor:string,refund:string,method:"cash"|"promptpay",reference:string) { return z.object({success:z.literal(true)}).parse(await request(shop,`refunds/${encodeURIComponent(refund)}/payout`,{method:"POST",body:JSON.stringify({actorStaffId:actor,method,reference,paidInReality:true})})); }
