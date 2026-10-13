import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { DEFAULT_ACCENT, LOGO_MAX_BYTES } from "@/lib/brand";
import { getBrand, getLogo, removeLogo, saveAccent, saveLogo } from "./brand";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let shopIds: string[] = [];

describe("brand service integration", () => {
  beforeAll(async () => {
    const created = await db.insert(shops).values([
      { name: `Brand Test A ${suffix}`, slug: `brand-test-a-${suffix}` },
      { name: `Brand Test B ${suffix}`, slug: `brand-test-b-${suffix}` },
    ]).returning({ id: shops.id });
    shopIds = created.map((shop) => shop.id);
  });

  afterAll(async () => {
    if (shopIds.length) await db.delete(shops).where(inArray(shops.id, shopIds));
  });

  it("returns the default look for a shop with no brand", async () => {
    expect(await getBrand(shopIds[0])).toEqual({ accent: DEFAULT_ACCENT, hasCustomAccent: false, logoUrl: null });
  });

  it("saves, normalises and resets the accent per shop", async () => {
    await saveAccent(shopIds[0], "5e7a3a");
    expect(await getBrand(shopIds[0])).toMatchObject({ accent: "#5E7A3A", hasCustomAccent: true });
    expect((await getBrand(shopIds[1])).hasCustomAccent).toBe(false);
    await expect(saveAccent(shopIds[0], "green")).rejects.toThrow("รหัสสีไม่ถูกต้อง");
    await saveAccent(shopIds[0], null);
    expect((await getBrand(shopIds[0])).accent).toBe(DEFAULT_ACCENT);
  });

  it("stores a logo, keeps the accent, and builds a cache-busted url", async () => {
    await saveAccent(shopIds[0], "#1F5F8B");
    await saveLogo(shopIds[0], png);
    const brand = await getBrand(shopIds[0]);
    expect(brand.accent).toBe("#1F5F8B");
    expect(brand.logoUrl).toMatch(new RegExp(`^/api/brand/${shopIds[0]}/logo\\?v=\\d+$`));
    const logo = await getLogo(shopIds[0]);
    expect(logo?.mime).toBe("image/png");
    expect([...(logo?.bytes ?? [])]).toEqual([...png]);
    expect(await getLogo(shopIds[1])).toBeNull();
  });

  it("rejects non-images and oversize files", async () => {
    await expect(saveLogo(shopIds[1], new TextEncoder().encode("<svg onload=alert(1)>"))).rejects.toThrow("PNG");
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(png);
    await expect(saveLogo(shopIds[1], big)).rejects.toThrow("300 KB");
    expect(await getLogo(shopIds[1])).toBeNull();
  });

  it("removes the logo but keeps the accent", async () => {
    await removeLogo(shopIds[0]);
    expect(await getBrand(shopIds[0])).toMatchObject({ accent: "#1F5F8B", logoUrl: null });
  });
});
