"use server";
import { z } from "zod";
import { requirePosStaff } from "@/server/pos-session";
import { decideSelfOrder, listSelfOrders } from "@/server/self-orders";
import { logger } from "@/lib/logger";
export async function loadRequestsAction() {
  const session = await requirePosStaff();
  try { return { ok: true as const, orders: await listSelfOrders(session.shopId, session.staff.id) }; }
  catch (error) { logger.error({ err: error, shopId: session.shopId }, "Self-order list failed"); return { ok: false as const, message: "โหลดรายการไม่สำเร็จ กรุณาลองใหม่" }; }
}
export async function decideRequestAction(id: string, decision: "accepted" | "rejected") {
  const session = await requirePosStaff();
  if (!z.uuid().safeParse(id).success || !["accepted", "rejected"].includes(decision)) { return { ok: false as const, message: "รายการไม่ถูกต้อง" }; }
  try { return { ok: true as const, order: await decideSelfOrder(session.shopId, session.staff.id, id, decision) }; }
  catch (error) { logger.error({ err: error, shopId: session.shopId, id }, "Self-order decision failed"); return { ok: false as const, message: "รายการอาจเปลี่ยนไปหรือเมนูไม่พร้อมขาย กรุณารีเฟรชและตรวจสอบกับลูกค้า" }; }
}
