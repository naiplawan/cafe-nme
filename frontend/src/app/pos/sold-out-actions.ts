"use server";

import { logger } from "@/lib/logger";
import { togglePosProductSoldOut } from "@/server/pos-operations";
import { requirePosStaff } from "@/server/pos-session";

// react-doctor-disable-next-line server-auth-actions -- requirePosStaff authenticates the paired device and active staff member before any query.
export async function toggleSoldOut(productId: string): Promise<{ ok: true; soldOut: boolean } | { ok: false; message: string }> {
  const session = await requirePosStaff();
  try {
    const product = await togglePosProductSoldOut(session.shopId, productId);
    if (!product) return { ok: false, message: "ไม่พบเมนูนี้" };
    return { ok: true, soldOut: product.soldOut };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId, productId }, "POS sold-out toggle failed");
    return { ok: false, message: "เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่" };
  }
}
