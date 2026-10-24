"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";
import { logger } from "@/lib/logger";
import { reviewPayment } from "@/server/reconciliation";
export async function reviewPaymentAction(_state:{message:string|null},data:FormData):Promise<{message:string|null;success?:boolean}> {
  const session=await requireStaff();
  if (session.staff.role === "barista") { return {message:"เฉพาะเจ้าของร้านหรือผู้จัดการเท่านั้นที่ตรวจยอดได้",success:false}; }
  const paymentId=String(data.get("paymentId")??"");
  const requestId=String(data.get("requestId")??"");
  const observedSatang=parseBahtToSatang(String(data.get("observed")??""));
  const note=String(data.get("note")??"").trim();
  if (!z.uuid().safeParse(paymentId).success || !z.uuid().safeParse(requestId).success
    || observedSatang===null || !Number.isSafeInteger(observedSatang) || observedSatang<0 || observedSatang>2_147_483_647 || note.length>500) {
    return {message:"กรุณากรอกยอดรับเงินจริงเป็นจำนวนตั้งแต่ศูนย์ขึ้นไป",success:false};
  }
  try { await reviewPayment(session.shopId,session.staff.id,paymentId,{requestId,observedSatang,note}); }
  catch(error) { logger.error({err:error,shopId:session.shopId},"Receipt review failed");return {message:"บันทึกผลตรวจไม่สำเร็จ หากยอดต่างกันกรุณาระบุเหตุผล แล้วลองรายการเดิมอีกครั้ง",success:false}; }
  revalidatePath("/admin/reconciliation");
  return {message:"บันทึกผลตรวจโดยพนักงานแล้ว",success:true};
}
