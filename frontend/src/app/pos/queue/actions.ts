"use server";
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
