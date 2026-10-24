"use server";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/server/rate-limit";
import { getSelfOrderShop, getSelfOrderStatus, selfOrderInputSchema, SelfOrderApiError, submitSelfOrder } from "@/server/self-orders";

async function authorizePublic(slug: string, status: boolean) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip")?.trim() || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  if (!isIP(address)) { throw new Error("Source unavailable"); }
  const shop = await getSelfOrderShop(slug);
  if (!shop) { throw new Error("Shop unavailable"); }
  const allowed = await consumeRateLimit(`${status ? "self-order-status" : "self-order"}:${shop.shopId}:${address}`, status ? 60 : 10, status ? 60 : 600);
  if (!allowed) { throw new Error("Rate limited"); }
  return shop;
}
export async function submitSelfOrderAction(slug: string, value: unknown) {
  const parsed = selfOrderInputSchema.safeParse(value);
  if (!parsed.success) { return { ok: false as const, retryable: false, message: "รายการไม่ถูกต้อง กรุณาตรวจสอบจำนวนและตัวเลือก" }; }
  try {
    const shop = await authorizePublic(slug, false);
    return { ok: true as const, order: await submitSelfOrder(shop.shopId, parsed.data) };
  } catch (error) {
    const rejected = error instanceof SelfOrderApiError && (error.status === 400 || error.status === 403);
    return { ok: false as const, retryable: !rejected, message: rejected ? "ร้านหรือเมนูไม่พร้อมรับรายการออนไลน์ กรุณาติดต่อพนักงาน" : "ยังยืนยันคำสั่งซื้อไม่ได้ กรุณารอสักครู่แล้วตรวจสอบรายการเดิม" };
  }
}
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export async function selfOrderStatusAction(slug: string, statusToken: string) {
  if (!TOKEN_PATTERN.test(statusToken)) { return { ok: false as const, message: "ไม่พบรหัสตรวจสอบรายการ" }; }
  try {
    const shop = await authorizePublic(slug, true);
    return { ok: true as const, order: await getSelfOrderStatus(shop.shopId, statusToken) };
  } catch {
    return { ok: false as const, message: "ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่" };
  }
}
