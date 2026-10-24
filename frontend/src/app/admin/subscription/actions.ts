"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSubscription, recordManualRenewal } from "@/server/subscriptions";

export type RenewalActionState = { success: boolean; message: string } | null;
const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/).transform((value) => {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}).pipe(z.number().int().min(1).max(2147483647));

export async function recordManualRenewalAction(_previous: RenewalActionState, form: FormData): Promise<RenewalActionState> {
  const session = await requireStaff();
  const current = await getSubscription(session.shopId, session.staff.id, session.userId);
  if (!current.canRecordPayment) { return { success: false, message: "เฉพาะผู้ดูแลการเรียกเก็บเงินของแพลตฟอร์มที่ได้รับสิทธิ์เท่านั้น" }; }
  const parsed = z.object({ requestId: z.uuid(), plan: z.enum(["basic", "pro"]), paidAmountSatang: amountSchema,
    periodDays: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(366)), externalReceiptRef: z.string().trim().min(1).max(200) })
    .safeParse({ requestId: form.get("requestId"), plan: form.get("plan"), paidAmountSatang: form.get("amount"),
      periodDays: form.get("periodDays"), externalReceiptRef: form.get("externalReceiptRef") });
  if (!parsed.success) { return { success: false, message: "ตรวจสอบแผน ยอดรับชำระ จำนวนวัน (1–366) และเลขอ้างอิงหลักฐาน" }; }
  try { await recordManualRenewal(session.shopId, session.staff.id, session.userId, parsed.data); }
  catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Manual subscription renewal failed");
    return { success: false, message: "ยังไม่ทราบผลการบันทึก กรุณาลองส่งข้อมูลและหลักฐานเดิมอีกครั้ง เลขอ้างอิงหนึ่งรายการใช้ต่ออายุได้ครั้งเดียว" };
  }
  revalidatePath("/admin/subscription");
  revalidatePath("/admin/inventory");
  return { success: true, message: "บันทึกหลักฐานและต่ออายุแล้ว ไม่มีการตัดเงินผ่านหน้านี้" };
}
