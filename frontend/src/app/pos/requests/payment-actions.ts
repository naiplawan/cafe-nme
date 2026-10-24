"use server";
import { z } from "zod";
import { requirePosStaff } from "@/server/pos-session";
import { createProviderPayment, getProviderPayment, refreshProviderPayment } from "@/server/provider-payments";
import { logger } from "@/lib/logger";

async function run(id: string, action: "get" | "create" | "refresh") {
  const session = await requirePosStaff();
  if (!z.uuid().safeParse(id).success) { return { ok: false as const, message: "รายการไม่ถูกต้อง" }; }
  try {
    const view = action === "get" ? await getProviderPayment(session.shopId, session.staff.id, id)
      : action === "create" ? await createProviderPayment(session.shopId, session.staff.id, id)
        : await refreshProviderPayment(session.shopId, session.staff.id, id);
    return { ok: true as const, view };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId, selfOrderId: id, action }, "Provider payment request failed");
    return { ok: false as const, message: action === "refresh" ? "ตรวจสถานะไม่ได้ กรุณาลองใหม่ รายการชำระเดิมยังอยู่" : "เริ่มรับชำระไม่ได้ กรุณาตรวจสอบกับร้านก่อนลองใหม่" };
  }
}
export async function loadProviderPaymentAction(id: string) { return run(id, "get"); }
export async function startProviderPaymentAction(id: string) { return run(id, "create"); }
export async function refreshProviderPaymentAction(id: string) { return run(id, "refresh"); }
