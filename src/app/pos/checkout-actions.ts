"use server";

import "server-only";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { members, orders, shops } from "@/db/schema";
import { logger } from "@/lib/logger";
import { formatBaht } from "@/lib/money";
import { CheckoutError, checkout, getOrder, type CheckoutInput, type CheckoutResult } from "@/server/orders";
import { requirePosStaff } from "@/server/pos-session";
import { pushText } from "@/server/line";

export type CheckoutActionResult = { ok: true; result: CheckoutResult } | { ok: false; message: string };

const CHECKOUT_MESSAGES: Record<CheckoutError["code"], string> = {
  empty_cart: "ยังไม่มีรายการ",
  pricing: "เมนูหรือตัวเลือกไม่ถูกต้อง กรุณาลองใหม่",
  sold_out: "มีเมนูหมดแล้ว กรุณานำออกจากออเดอร์",
  member_not_found: "ไม่พบสมาชิก",
  reward_unavailable: "รางวัลนี้ใช้ไปแล้ว",
  cash_insufficient: "รับเงินไม่พอ",
};

export async function checkoutAction(input: CheckoutInput): Promise<CheckoutActionResult> {
  const session = await requirePosStaff();
  try {
    if (input.payment.method === "promptpay") {
      const [shop] = await db.select({ promptpayId: shops.promptpayId }).from(shops)
        .where(eq(shops.id, session.shopId)).limit(1);
      if (!shop?.promptpayId) return { ok: false, message: "ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ในหลังร้าน" };
    }
    const result = await checkout({ shopId: session.shopId, staffId: session.staff.id }, input);
    return { ok: true, result };
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, message: CHECKOUT_MESSAGES[error.code] };
    logger.error({ err: error, shopId: session.shopId }, "POS checkout failed");
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function promptPayQr(amountSatang: number): Promise<{ svg: string } | { error: string }> {
  const session = await requirePosStaff();
  const [shop] = await db.select({ promptpayId: shops.promptpayId }).from(shops)
    .where(eq(shops.id, session.shopId)).limit(1);
  if (!shop?.promptpayId) return { error: "ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ในหลังร้าน" };
  if (!Number.isSafeInteger(amountSatang) || amountSatang < 0) return { error: "ยอดชำระไม่ถูกต้อง" };

  try {
    const payload = generatePayload(shop.promptpayId, { amount: Number((amountSatang / 100).toFixed(2)) });
    const svg = await QRCode.toString(payload, { type: "svg", margin: 1, width: 260 });
    return { svg };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "PromptPay QR generation failed");
    return { error: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function sendReceiptToLine(orderId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requirePosStaff();
    const [order] = await db.select({ memberId: orders.memberId, dailyNo: orders.dailyNo })
      .from(orders).where(and(eq(orders.id, orderId), eq(orders.shopId, session.shopId))).limit(1);
    if (!order) return { ok: false, message: "ไม่พบออเดอร์นี้" };
    if (!order.memberId) return { ok: false, message: "ออเดอร์นี้ไม่มีข้อมูลสมาชิก" };

    const [member] = await db.select({ lineUserId: members.lineUserId }).from(members).where(and(
      eq(members.id, order.memberId), eq(members.shopId, session.shopId), isNull(members.deletedAt),
    )).limit(1);
    if (!member?.lineUserId) return { ok: false, message: "สมาชิกยังไม่ได้เชื่อมต่อ LINE" };

    const detail = await getOrder(session.shopId, orderId);
    if (!detail) return { ok: false, message: "ไม่พบออเดอร์นี้" };
    const itemLines = detail.items.map((item) => `${item.qty} × ${item.name}`).join("\n");
    const receipt = `ใบเสร็จออเดอร์ #${String(order.dailyNo).padStart(3, "0")}\n${itemLines}\nยอดชำระ ${formatBaht(detail.totalSatang)}\nขอบคุณที่มาอุดหนุนค่ะ`;
    await pushText(session.shopId, member.lineUserId, receipt);
    return { ok: true, message: "ส่งใบเสร็จทาง LINE แล้ว" };
  } catch (error) {
    logger.error({ err: error, orderId }, "POS LINE receipt failed");
    return { ok: false, message: "ส่งใบเสร็จไม่สำเร็จ กรุณาลองใหม่" };
  }
}
