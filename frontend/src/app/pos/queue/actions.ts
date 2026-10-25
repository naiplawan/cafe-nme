"use server";
import { remakeDrink } from "@/server/inventory";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { requirePosStaff } from "@/server/pos-session";
import { listPreparation, transitionPreparation, type PreparationStatus } from "@/server/preparation";

export async function loadQueueAction() {
  const session = await requirePosStaff();
  try {
    return { ok: true as const, rows: await listPreparation(session.shopId, session.staff.id) };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Preparation queue refresh failed");
    return { ok: false as const, message: "โหลดคิวไม่สำเร็จ กรุณารีเฟรชอีกครั้ง" };
  }
}

export async function advancePreparationAction(orderId: string, expected: PreparationStatus, desired: PreparationStatus) {
  const session = await requirePosStaff();
  if (!z.uuid().safeParse(orderId).success || !((expected === "received" && desired === "preparing") || (expected === "preparing" && desired === "ready"))) {
    return { ok: false as const, message: "รายการเปลี่ยนสถานะไม่ถูกต้อง กรุณารีเฟรชคิว" };
  }
  try {
    return { ok: true as const, update: await transitionPreparation(session.shopId, session.staff.id, orderId, expected, desired) };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId, orderId }, "Preparation transition failed");
    return { ok: false as const, message: "ยังยืนยันสถานะไม่ได้ ระบบจะตรวจสอบคิวล่าสุด กรุณาตรวจสอบก่อนลองใหม่" };
  }
}

export async function remakeDrinkAction(input: { orderId: string; itemId: string; requestId: string; qty: number; reason: string }) {
  const session = await requirePosStaff();
  const parsed = z.object({ orderId: z.uuid(), itemId: z.uuid(), requestId: z.uuid(), qty: z.number().int().min(1).max(99), reason: z.string().trim().min(1).max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: 'ระบุจำนวนและเหตุผลที่ทำใหม่' };
  try { await remakeDrink(session.shopId, session.staff.id, parsed.data.orderId, parsed.data.itemId, { requestId: parsed.data.requestId, qty: parsed.data.qty, reason: parsed.data.reason }); }
  catch (error) {
    logger.error({ err: error, shopId: session.shopId }, 'Drink remake failed');
    return { ok: false, message: 'ทำใหม่ไม่สำเร็จ ตรวจสอบวัตถุดิบและสถานะออเดอร์ หรือลองรายการเดิมอีกครั้ง' };
  }
  return { ok: true, message: 'บันทึกทำใหม่และตัดวัตถุดิบแล้ว ไม่เพิ่มยอดขาย' };
}
