"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePosStaff } from "@/server/pos-session";
import { createRefund,recordRefundPayout } from "@/server/refunds";
import { formatBaht } from "@/lib/money";
import { logger } from "@/lib/logger";
interface State {message:string|null;success?:boolean}
const schema=z.object({orderId:z.uuid(),requestId:z.uuid(),reason:z.string().trim().min(1).max(500),lines:z.array(z.object({itemId:z.uuid(),qty:z.number().int().min(1).max(99)})).min(1).max(100)});
export async function refundAction(_state:State,data:FormData):Promise<State> {
 const session=await requirePosStaff();
 if(session.staff.role==='barista') { return {success:false,message:"ต้องให้เจ้าของร้านหรือผู้จัดการอนุมัติ"}; }
 const lines=[...data.entries()].filter(([key,value])=>key.startsWith("qty:")&&String(value)!=="0"&&String(value)!=="").map(([key,value])=>({itemId:key.slice(4),qty:Number(value)}));
 const parsed=schema.safeParse({orderId:data.get('orderId'),requestId:data.get('requestId'),reason:data.get('reason'),lines});
 if(!parsed.success) { return {success:false,message:"เลือกรายการ จำนวน และเหตุผลคืนเงินให้ครบ"}; }
 try {
 const {orderId,...input}=parsed.data;const refund=await createRefund(session.shopId,session.staff.id,orderId,input);
 revalidatePath(`/pos/refunds/${orderId}`);return {success:true,message:`อนุมัติคืน ${formatBaht(refund.amountSatang)} แล้ว ยังไม่ได้จ่ายคืน`};
 } catch(error) { logger.error({err:error,shopId:session.shopId},"Partial refund failed");return {success:false,message:"คืนรายการไม่สำเร็จ กรุณาตรวจจำนวนที่คืนไปแล้วและสิทธิ์สมาชิก"}; }
}
export async function payoutAction(_state:State,data:FormData):Promise<State> {
 const session=await requirePosStaff();
 if(session.staff.role==='barista') { return {success:false,message:"ต้องให้เจ้าของร้านหรือผู้จัดการบันทึก"}; }
 const parsed=z.object({refundId:z.uuid(),orderId:z.uuid(),method:z.enum(['cash','promptpay']),reference:z.string().trim().min(1).max(200),paidInReality:z.literal('yes')}).safeParse(Object.fromEntries(data));
 if(!parsed.success) { return {success:false,message:"ระบุวิธีจ่าย หลักฐานอ้างอิง และยืนยันว่าจ่ายเงินจริงแล้ว"}; }
 try { const {refundId,method,reference,orderId}=parsed.data;await recordRefundPayout(session.shopId,session.staff.id,refundId,method,reference);revalidatePath(`/pos/refunds/${orderId}`);revalidatePath('/pos/shifts');return {success:true,message:"บันทึกว่าพนักงานจ่ายคืนแล้ว"}; }
 catch(error) { logger.error({err:error,shopId:session.shopId},"Refund payout record failed");return {success:false,message:"บันทึกจ่ายคืนไม่สำเร็จ เงินสดต้องมีกะที่เปิดอยู่ และห้ามเปลี่ยนรายการที่จ่ายแล้ว"}; }
}
