"use server";

import { revalidatePath } from "next/cache";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getPromptPaySettings, savePromptPayId } from "@/server/payment-settings";

export interface PromptPayActionState {
  message: string | null;
  success: boolean;
  fieldError?: string;
}
export type PromptPayPreviewResult = { ok: true; svg: string } | { ok: false; message: string };

const PROMPTPAY_ID = /^(0\d{9}|\d{13})$/;
const SHOP_CHANGED_MESSAGE = "ร้านที่เลือกเปลี่ยนไป กรุณาโหลดหน้าใหม่ก่อนดำเนินการ";
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

export async function savePromptPayAction(expectedShopId: string, _previous: PromptPayActionState, formData: FormData): Promise<PromptPayActionState> {
  const session = await ownerSession();
  if (!session) return { message: "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนการตั้งค่านี้ได้", success: false };
  if (session.shopId !== expectedShopId) { return { message: SHOP_CHANGED_MESSAGE, success: false }; }
  const value = formData.get("promptpayId");
  const parsed = inputSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) {
    const fieldError = parsed.error.issues[0]?.message ?? "PromptPay ID ไม่ถูกต้อง";
    return { message: fieldError, fieldError, success: false };
  }

  try {
    await savePromptPayId(session.shopId, session.staff.id, parsed.data);
  } catch {
    return { message: "บันทึก PromptPay ID ไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePaymentPages();
  return { message: "บันทึก PromptPay ID แล้ว", success: true };
}

export async function clearPromptPayAction(expectedShopId: string, _previous: PromptPayActionState): Promise<PromptPayActionState> {
  void _previous;
  const session = await ownerSession();
  if (!session) return { message: "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนการตั้งค่านี้ได้", success: false };
  if (session.shopId !== expectedShopId) { return { message: SHOP_CHANGED_MESSAGE, success: false }; }

  try {
    await savePromptPayId(session.shopId, session.staff.id, null);
  } catch {
    return { message: "ปิดพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePaymentPages();
  return { message: "ปิดการรับชำระด้วยพร้อมเพย์แล้ว", success: true };
}

export async function previewPromptPayAction(expectedShopId: string): Promise<PromptPayPreviewResult> {
  const session = await ownerSession();
  if (!session) {
    return { ok: false, message: "เฉพาะเจ้าของร้านเท่านั้นที่ดู QR ทดสอบได้" };
  }
  if (session.shopId !== expectedShopId) { return { ok: false, message: SHOP_CHANGED_MESSAGE }; }

  try {
    const settings = await getPromptPaySettings(session.shopId, session.staff.id);
    if (!settings.promptpayId) {
      return { ok: false, message: "ร้านยังไม่ได้ตั้งค่าพร้อมเพย์" };
    }

    const payload = generatePayload(settings.promptpayId, { amount: 1 });
    const svg = await QRCode.toString(payload, { type: "svg", margin: 1, width: 280 });
    if (!svg.trimStart().startsWith("<svg")) {
      return { ok: false, message: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" };
    }
    return { ok: true, svg };
  } catch {
    return { ok: false, message: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" };
  }
}
