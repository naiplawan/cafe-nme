"use server";

import "server-only";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { logger } from "@/lib/logger";
import { formatBaht } from "@/lib/money";
import { getPosPromptPayConfig, getPosReceiptRecipient } from "@/server/pos-operations";
import { CheckoutError, quoteCheckout, checkout, getOrder, type CheckoutInput, type CheckoutResult } from "@/server/orders";
import { requirePosStaff } from "@/server/pos-session";
import { pushText } from "@/server/line";
import type { CheckoutSessionScope } from "@/lib/checkout-attempt";

export type CheckoutActionResult = { ok: true; result: CheckoutResult } | { ok: false; message: string; retryable?: boolean };

const CHECKOUT_MESSAGES: Record<CheckoutError["code"], string> = {
  price_changed: "ราคาหรือส่วนลดเปลี่ยนไป กรุณากลับไปตรวจสอบยอดก่อนชำระอีกครั้ง",
  cart_limit_exceeded: "ออเดอร์ต้องไม่เกิน 100 รายการและ 500 ชิ้น กรุณาลดจำนวนหรือแยกออเดอร์",
  invalid_checkout: "รายการไม่ถูกต้อง กรุณากลับไปตรวจสอบตะกร้า",
  empty_cart: "ยังไม่มีรายการ",
  pricing: "เมนูหรือตัวเลือกไม่ถูกต้อง กรุณาลองใหม่",
  sold_out: "มีเมนูหมดแล้ว กรุณานำออกจากออเดอร์",
  member_not_found: "ไม่พบสมาชิก",
  reward_unavailable: "รางวัลนี้ใช้ไปแล้ว",
  cash_insufficient: "รับเงินไม่พอ",
  promptpay_not_configured: "ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ในหลังร้าน",
  idempotency_key_reused: "รายการชำระเงินเปลี่ยนไป กรุณากลับไปตรวจสอบออเดอร์",
};

const ORIGINAL_SESSION_MESSAGE = "กรุณาเข้าสู่ระบบด้วยพนักงานและอุปกรณ์เดิมเพื่อดำเนินการต่อ";

export async function checkoutAction(input: CheckoutInput & { expectedScope?: CheckoutSessionScope }): Promise<CheckoutActionResult> {
  const session = await requirePosStaff();
  const { expectedScope, ...checkoutInput } = input;
  if (
    !expectedScope
    || expectedScope.shopId !== session.shopId
    || expectedScope.staffId !== session.staff.id
    || expectedScope.deviceId !== session.deviceId
  ) {
    return { ok: false, message: ORIGINAL_SESSION_MESSAGE, retryable: true };
  }

  try {
    const result = await checkout({ shopId: session.shopId, staffId: session.staff.id }, checkoutInput);
    return { ok: true, result };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return {
        ok: false,
        message: CHECKOUT_MESSAGES[error.code],
        ...(error.code === "idempotency_key_reused" ? { retryable: true } : {}),
      };
    }
    logger.error({ err: error, shopId: session.shopId }, "POS checkout failed");
    return { ok: false, message: "ยังไม่ทราบผลการบันทึก กรุณาลองตรวจสอบรายการเดิมอีกครั้ง", retryable: true };
  }
}

export async function promptPayQr(amountSatang: number): Promise<{ svg: string } | { error: string }> {
  const session = await requirePosStaff();
  const shop = await getPosPromptPayConfig(session.shopId);
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
    const order = await getPosReceiptRecipient(session.shopId, orderId);
    if (!order) return { ok: false, message: "ไม่พบออเดอร์นี้" };
    if (!order.hasMember) return { ok: false, message: "ออเดอร์นี้ไม่มีข้อมูลสมาชิก" };
    if (!order.lineUserId) return { ok: false, message: "สมาชิกยังไม่ได้เชื่อมต่อ LINE" };

    const detail = await getOrder(session.shopId, orderId);
    if (!detail) return { ok: false, message: "ไม่พบออเดอร์นี้" };
    const itemLines = detail.items.map((item) => `${item.qty} × ${item.name}`).join("\n");
    const receipt = `ใบเสร็จออเดอร์ #${String(order.dailyNo).padStart(3, "0")}\n${itemLines}\nยอดชำระ ${formatBaht(detail.totalSatang)}\nขอบคุณที่มาอุดหนุนค่ะ`;
    await pushText(session.shopId, order.lineUserId, receipt);
    return { ok: true, message: "ส่งใบเสร็จทาง LINE แล้ว" };
  } catch (error) {
    logger.error({ err: error, orderId }, "POS LINE receipt failed");
    return { ok: false, message: "ส่งใบเสร็จไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function quoteCheckoutAction(input: Omit<CheckoutInput, "payment">) {
  const session = await requirePosStaff();
  try {
    return { ok: true as const, quote: await quoteCheckout({ shopId: session.shopId, staffId: session.staff.id }, input) };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "POS quote failed");
    return { ok: false as const, message: error instanceof CheckoutError ? CHECKOUT_MESSAGES[error.code] : "ตรวจสอบราคาไม่สำเร็จ กรุณาลองใหม่" };
  }
}
