import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { categories, modifierGroups, productModifierGroups, products, shops } from "@/db/schema";
import { categoryNameExists, createProduct, restoreProductsForSale } from "./menu";

describe("menu product creation", () => {
  const slug = `menu-test-${randomUUID()}`;
  let shopId: string;
  let groupId: string;

  beforeAll(async () => {
    const [shop] = await db.insert(shops).values({ name: "Menu Test", slug }).returning();
    shopId = shop.id;
    const [group] = await db.insert(modifierGroups).values({ shopId, name: "ขนาด", minSelect: 0, maxSelect: 1 }).returning();
    groupId = group.id;
  });

  afterAll(async () => {
    if (shopId) await db.delete(shops).where(eq(shops.id, shopId));
  });

  it("links selected modifier groups when creating a product", async () => {
    const [product] = await createProduct(shopId, {
      name: "ลาเต้", price: 5000, categoryId: null, imageUrl: null, earnsStamp: true, isActive: true,
    }, [groupId]);
    const links = await db.select({ groupId: productModifierGroups.groupId })
      .from(productModifierGroups).where(eq(productModifierGroups.productId, product.id));

    expect(links).toEqual([{ groupId }]);
  });

  it("matches category names case-insensitively and can exclude the current category", async () => {
    const [category] = await db.insert(categories).values({ shopId, name: "เครื่องดื่ม" }).returning();

    await expect(categoryNameExists(shopId, "  เครื่องดื่ม ")).resolves.toBe(true);
    await expect(categoryNameExists(shopId, "เครื่องดื่ม", category.id)).resolves.toBe(false);
  });

  it("reactivates selected products and clears their sold-out status", async () => {
    const [product] = await db.insert(products).values({
      shopId,
      name: "ชาไทยหมด",
      basePriceSatang: 5000,
      isActive: false,
      soldOut: true,
    }).returning();

    await expect(restoreProductsForSale(shopId, [product.id])).resolves.toEqual([{ id: product.id }]);
    const [updated] = await db.select({ isActive: products.isActive, soldOut: products.soldOut })
      .from(products).where(eq(products.id, product.id));
    expect(updated).toEqual({ isActive: true, soldOut: false });
  });
});
