import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { categories, modifierGroups, productModifierGroups, products, shops } from "@/db/schema";
import { getPosMenu } from "./catalog";
import { togglePosProductSoldOut } from "./pos-operations";
import { categoryNameExists, createProduct, getProduct, listProducts, reorderCategories, reorderProducts, restoreProductsForSale, updateMenuSettings, updateProductsModifierGroup } from "./menu";

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

  it("adds a modifier group to many products once and removes it again", async () => {
    const rows = await db.insert(products).values([
      { shopId, name: "อเมริกาโน่", basePriceSatang: 4500 },
      { shopId, name: "ลาเต้เย็น", basePriceSatang: 5500 },
    ]).returning();
    const ids = rows.map((row) => row.id);
    const linked = async () => (await db.select({ productId: productModifierGroups.productId })
      .from(productModifierGroups).where(eq(productModifierGroups.groupId, groupId)))
      .map((row) => row.productId).filter((id) => ids.includes(id)).sort();

    await expect(updateProductsModifierGroup(shopId, ids, "add", groupId)).resolves.toHaveLength(2);
    await expect(updateProductsModifierGroup(shopId, ids, "add", groupId)).resolves.toHaveLength(0);
    expect(await linked()).toEqual([...ids].sort());
    await expect(updateProductsModifierGroup(shopId, ids, "remove", groupId)).resolves.toHaveLength(2);
    expect(await linked()).toEqual([]);
  });

  it("reopens products sold out on an earlier day only when auto-clear is on", async () => {
    const [yesterday, today] = await db.insert(products).values([
      { shopId, name: "หมดเมื่อวาน", basePriceSatang: 4000, soldOut: true, soldOutOn: "2000-01-01" },
      { shopId, name: "หมดวันนี้", basePriceSatang: 4000, soldOut: true, soldOutOn: "9999-12-31" },
    ]).returning();
    const soldOut = async () => Object.fromEntries((await listProducts(shopId)).map((row) => [row.id, row.soldOut]));

    await updateMenuSettings(shopId, false);
    expect((await soldOut())[yesterday.id]).toBe(true);
    await updateMenuSettings(shopId, true);
    const after = await soldOut();
    expect(after[yesterday.id]).toBe(false);
    expect(after[today.id]).toBe(true);
  });

  it("records the shop's business date when the POS marks a product sold out", async () => {
    const [product] = await db.insert(products).values({ shopId, name: "โกโก้", basePriceSatang: 4500 }).returning();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const row = async () => (await db.select({ soldOut: products.soldOut, soldOutOn: products.soldOutOn })
      .from(products).where(eq(products.id, product.id)))[0];

    await togglePosProductSoldOut(shopId, product.id);
    expect(await row()).toEqual({ soldOut: true, soldOutOn: today });
    await togglePosProductSoldOut(shopId, product.id);
    expect(await row()).toEqual({ soldOut: false, soldOutOn: null });
  });

  it("saves the order shown to staff and rejects an order that misses an item", async () => {
    // A fresh shop keeps this test independent of the rows other tests inserted.
    const [shop] = await db.insert(shops).values({ name: "Order Test", slug: `${slug}-order` }).returning();
    try {
      const [coffee, tea] = await db.insert(categories).values([
        { shopId: shop.id, name: "กาแฟ", sort: 0 },
        { shopId: shop.id, name: "ชา", sort: 1 },
      ]).returning();
      const [latte, mocha, matcha] = await db.insert(products).values([
        { shopId: shop.id, categoryId: coffee.id, name: "ลาเต้", basePriceSatang: 5500, sort: 0 },
        { shopId: shop.id, categoryId: coffee.id, name: "มอคค่า", basePriceSatang: 6000, sort: 1 },
        { shopId: shop.id, categoryId: tea.id, name: "มัทฉะ", basePriceSatang: 6500, sort: 2 },
      ]).returning();

      await reorderCategories(shop.id, [tea.id, coffee.id]);
      await reorderProducts(shop.id, [matcha.id, mocha.id, latte.id]);
      expect((await listProducts(shop.id)).map((row) => row.name)).toEqual(["มัทฉะ", "มอคค่า", "ลาเต้"]);

      await expect(reorderProducts(shop.id, [mocha.id, latte.id])).rejects.toThrow("409");
      await expect(reorderProducts(shop.id, [matcha.id, matcha.id, latte.id])).rejects.toThrow("400");
    } finally {
      await db.delete(shops).where(eq(shops.id, shop.id));
    }
  });

  it("saves a tile colour and serves it to the POS", async () => {
    const [product] = await createProduct(shopId, {
      name: "น้ำผึ้งมะนาว", price: 5000, categoryId: null, imageUrl: null, tileColor: "emerald", earnsStamp: true, isActive: true,
    });
    expect((await getProduct(shopId, product.id))?.tileColor).toBe("emerald");
    expect((await getPosMenu(shopId)).products.find((row) => row.id === product.id)?.tileColor).toBe("emerald");
    await expect(createProduct(shopId, {
      name: "สีผิด", price: 5000, categoryId: null, imageUrl: null, tileColor: "red", earnsStamp: true, isActive: true,
    })).rejects.toThrow("400");
  });
});
