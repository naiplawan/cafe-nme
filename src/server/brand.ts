import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shopBrands } from "@/db/schema";
import { brandLogoUrl, DEFAULT_ACCENT, LOGO_MAX_BYTES, normalizeHex, sniffImageMime } from "@/lib/brand";

export type ShopBrand = {
  /** Resolved accent: the shop's own, or DEFAULT_ACCENT. */
  accent: string;
  hasCustomAccent: boolean;
  /** Cache-busted public URL, or null when the shop has no logo (use /assets/logo-mark.png). */
  logoUrl: string | null;
};

export async function getBrand(shopId: string): Promise<ShopBrand> {
  const [row] = await db.select({ accent: shopBrands.accent, logoMime: shopBrands.logoMime, updatedAt: shopBrands.updatedAt })
    .from(shopBrands).where(eq(shopBrands.shopId, shopId)).limit(1);
  return {
    accent: row?.accent ?? DEFAULT_ACCENT,
    hasCustomAccent: Boolean(row?.accent),
    logoUrl: row?.logoMime ? brandLogoUrl(shopId, row.updatedAt) : null,
  };
}

export async function getLogo(shopId: string): Promise<{ bytes: Buffer; mime: string; updatedAt: Date } | null> {
  const [row] = await db.select({ logo: shopBrands.logo, logoMime: shopBrands.logoMime, updatedAt: shopBrands.updatedAt })
    .from(shopBrands).where(eq(shopBrands.shopId, shopId)).limit(1);
  if (!row?.logo || !row.logoMime) return null;
  return { bytes: row.logo, mime: row.logoMime, updatedAt: row.updatedAt };
}

async function upsert(shopId: string, values: Partial<typeof shopBrands.$inferInsert>): Promise<void> {
  const set = { ...values, updatedAt: new Date() };
  await db.insert(shopBrands).values({ shopId, ...set }).onConflictDoUpdate({ target: shopBrands.shopId, set });
}

/** null resets to the default accent. Throws on an invalid colour. */
export async function saveAccent(shopId: string, accent: string | null): Promise<void> {
  const hex = accent === null ? null : normalizeHex(accent);
  if (accent !== null && !hex) throw new Error("รหัสสีไม่ถูกต้อง");
  await upsert(shopId, { accent: hex });
}

/** Accepts PNG / JPEG / WebP up to LOGO_MAX_BYTES; the type comes from the bytes, not the client. */
export async function saveLogo(shopId: string, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength === 0) throw new Error("กรุณาเลือกไฟล์โลโก้");
  if (bytes.byteLength > LOGO_MAX_BYTES) throw new Error("ไฟล์โลโก้ใหญ่เกิน 300 KB");
  const mime = sniffImageMime(bytes);
  if (!mime) throw new Error("รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP");
  await upsert(shopId, { logo: Buffer.from(bytes), logoMime: mime });
}

export async function removeLogo(shopId: string): Promise<void> {
  await upsert(shopId, { logo: null, logoMime: null });
}
