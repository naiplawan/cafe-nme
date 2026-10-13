"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { logger } from "@/lib/logger";
import { requirePosStaff } from "@/server/pos-session";

export async function toggleSoldOut(productId: string): Promise<{ ok: true; soldOut: boolean } | { ok: false; message: string }> {
  const session = await requirePosStaff();
  try {
    const [product] = await db.select({ soldOut: products.soldOut }).from(products)
      .where(and(eq(products.id, productId), eq(products.shopId, session.shopId))).limit(1);
    if (!product) return { ok: false, message: "ไม่พบเมนูนี้" };
    const soldOut = !product.soldOut;
    const updated = await db.update(products).set({ soldOut })
      .where(and(eq(products.id, productId), eq(products.shopId, session.shopId))).returning({ soldOut: products.soldOut });
    if (!updated[0]) return { ok: false, message: "เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่" };
    return { ok: true, soldOut: updated[0].soldOut };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId, productId }, "POS sold-out toggle failed");
    return { ok: false, message: "เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่" };
  }
}
