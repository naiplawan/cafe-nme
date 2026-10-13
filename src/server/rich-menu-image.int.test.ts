import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { saveAccent } from "./brand";
import { renderRichMenuPng } from "./rich-menu-image";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let shopId = "";

describe("rich menu image integration", () => {
  beforeAll(async () => {
    const [shop] = await db.insert(shops).values({ name: `Rich Menu Test ${suffix}`, slug: `rich-menu-test-${suffix}` })
      .returning({ id: shops.id });
    shopId = shop.id;
    await saveAccent(shopId, "#5E7A3A");
  });

  afterAll(async () => {
    if (shopId) await db.delete(shops).where(inArray(shops.id, [shopId]));
  });

  it("renders a LINE-sized PNG with the shop accent", async () => {
    const png = await renderRichMenuPng(shopId);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(2500);
    expect(png.readUInt32BE(20)).toBe(1686);
    expect(png.byteLength).toBeLessThan(1024 * 1024);
    await writeFile(join(tmpdir(), "rich-menu-preview.png"), png);
  });
});
