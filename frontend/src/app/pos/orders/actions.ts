"use server";

import { getOrder, OrderVoidError, voidOrder, type OrderDetail } from "@/server/orders";
import { requirePosStaff, verifyManagerPin } from "@/server/pos-session";
import { consumeRateLimit } from "@/server/rate-limit";

export async function getOrderAction(orderId: string): Promise<OrderDetail | null> {
  const session = await requirePosStaff();
  return getOrder(session.shopId, orderId);
}

export type VoidOrderActionResult = { ok: true } | { ok: false; message: string };

export async function voidOrderAction(orderId: string, pin: string): Promise<VoidOrderActionResult> {
  const session = await requirePosStaff();
  if (!(await consumeRateLimit(`pos-manager-pin:${session.deviceId}`, 12, 15 * 60))) {
    return { ok: false, message: "ลองใส่ PIN ผู้จัดการมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" };
  }
  const manager = await verifyManagerPin(session.shopId, pin);
  if (!manager) return { ok: false, message: "PIN ผู้จัดการไม่ถูกต้อง" };

  try {
    await voidOrder(session.shopId, orderId, manager.staffId);
    return { ok: true };
  } catch (error) {
    if (error instanceof OrderVoidError) {
      return { ok: false, message: "กรุณายกเลิกบิลที่ใช้รางวัลนี้ก่อน แล้วจึงยกเลิกบิลที่ได้รับรางวัล" };
    }
    const latest = await getOrder(session.shopId, orderId);
    if (latest?.status === "void") return { ok: true };
    throw error;
  }
}
