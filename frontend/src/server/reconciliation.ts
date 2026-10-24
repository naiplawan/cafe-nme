import "server-only";
import { z } from "zod";
import { internalApiFetch } from "./internal-api";
const rowSchema = z.object({
  paymentId:z.uuid(),dailyNo:z.number().int(),method:z.enum(["cash","promptpay"]),
  expectedSatang:z.number().int(),observedSatang:z.number().int().nullable(),differenceSatang:z.number().int().nullable(),
  status:z.enum(["pending","matched","discrepancy"]),recordedBy:z.string().nullable(),reviewedBy:z.string().nullable(),
  reviewedAt:z.string().nullable(),source:z.enum(["staff","provider"]).nullable(),note:z.string().nullable(),
}).strict();
export async function listReconciliation(shopId:string,actorStaffId:string,day:string) {
  const query=new URLSearchParams({actorStaffId,day});
  const response=await internalApiFetch(`/v1/shops/${encodeURIComponent(shopId)}/reconciliation?${query}`);
  if (!response.ok) { throw new Error(`Receipt review API returned ${response.status}`); }
  return z.array(rowSchema).parse(await response.json());
}
export async function reviewPayment(shopId:string,actorStaffId:string,paymentId:string,input:{requestId:string;observedSatang:number;note:string}) {
  const response=await internalApiFetch(`/v1/shops/${encodeURIComponent(shopId)}/reconciliation/${encodeURIComponent(paymentId)}/reviews`,{
    method:"POST",body:JSON.stringify({...input,actorStaffId}),
  });
  if (!response.ok) { throw new Error(`Receipt review API returned ${response.status}`); }
  return z.object({id:z.uuid()}).strict().parse(await response.json());
}
