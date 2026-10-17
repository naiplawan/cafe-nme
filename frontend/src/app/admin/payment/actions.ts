"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { savePromptPayId } from "@/server/payment-settings";

export type PromptPayActionState = { message: string | null; success: boolean };

const PROMPTPAY_ID = /^(0\d{9}|\d{13})$/;
const inputSchema = z.string()
  .trim()
  .min(1, "กรุณากรอก PromptPay ID")
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => PROMPTPAY_ID.test(value), "กรอกเบอร์มือถือ 10 หลักหรือเลขประจำตัว 13 หลัก");

async function ownerSession() {
  const session = await requireStaff();
  return session.staff.role === "owner" ? session : null;
}

function revalidatePaymentPages() {
  revalidatePath("/admin/payment");
  revalidatePath("/admin");
}

export async function savePromptPayAction(_previous: PromptPayActionState, formData: FormData): Promise<PromptPayActionState> {
  const session = await ownerSession();
  if (!session) return { message: "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนการตั้งค่านี้ได้", success: false };
  const value = formData.get("promptpayId");
  const parsed = inputSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "PromptPay ID ไม่ถูกต้อง", success: false };

  try {
    await savePromptPayId(session.shopId, session.staff.id, parsed.data);
  } catch {
    return { message: "บันทึก PromptPay ID ไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePaymentPages();
  return { message: "บันทึก PromptPay ID แล้ว", success: true };
}

export async function clearPromptPayAction(_previous: PromptPayActionState): Promise<PromptPayActionState> {
  void _previous;
  const session = await ownerSession();
  if (!session) return { message: "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนการตั้งค่านี้ได้", success: false };

  try {
    await savePromptPayId(session.shopId, session.staff.id, null);
  } catch {
    return { message: "ปิดพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePaymentPages();
  return { message: "ปิดการรับชำระด้วยพร้อมเพย์แล้ว", success: true };
}
