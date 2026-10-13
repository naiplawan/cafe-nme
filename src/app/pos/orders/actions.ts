"use server";

import { getOrder, voidOrder, type OrderDetail } from "@/server/orders";
import { requirePosStaff, verifyManagerPin } from "@/server/pos-session";

export async function getOrderAction(orderId: string): Promise<OrderDetail | null> {
  const session = await requirePosStaff();
  return getOrder(session.shopId, orderId);
}

export type VoidOrderActionResult = { ok: true } | { ok: false; message: string };

export async function voidOrderAction(orderId: string, pin: string): Promise<VoidOrderActionResult> {
  const session = await requirePosStaff();
  const manager = await verifyManagerPin(session.shopId, pin);
  if (!manager) return { ok: false, message: "PIN ผู้จัดการไม่ถูกต้อง" };

  try {
    await voidOrder(session.shopId, orderId, manager.staffId);
    return { ok: true };
  } catch (error) {
    const latest = await getOrder(session.shopId, orderId);
    if (!latest || latest.status !== "paid") return { ok: false, message: "บิลนี้ยกเลิกไปแล้ว" };
    throw error;
  }
}
