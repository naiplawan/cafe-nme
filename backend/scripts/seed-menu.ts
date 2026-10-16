// Adds the stock menu (frontend/src/lib/menu-catalog.ts) to the demo shop. Safe to re-run:
// existing products (matched by name) only get a photo if they have none.
import { config } from "dotenv";
import { and, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories, modifierGroups, productModifierGroups, products, shops } from "../src/db/schema";
import { MENU_CATALOG, menuImageSrc, type MenuCatalogItem } from "../../frontend/src/lib/menu-catalog";

config({ path: "../frontend/.env.local" });

const groupsForKind: Record<MenuCatalogItem["kind"], string[]> = {
  coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
  milk: ["ความหวาน", "ประเภท", "นม"],
  drink: ["ความหวาน", "ประเภท"],
  bakery: [],
};

async function seedMenu() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL in .env.local.");
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, "demo-cafe")).limit(1);
    if (!shop) throw new Error("Run pnpm db:seed first (demo-cafe not found).");

    let added = 0;
    let imaged = 0;
    await db.transaction(async (tx) => {
      const categoryRows = await tx.select({ id: categories.id, name: categories.name, sort: categories.sort })
        .from(categories).where(eq(categories.shopId, shop.id));
      const categoryId = new Map(categoryRows.map((row) => [row.name, row.id]));
      for (const name of new Set(MENU_CATALOG.map((item) => item.category))) {
        if (categoryId.has(name)) continue;
        const [row] = await tx.insert(categories)
          .values({ shopId: shop.id, name, sort: Math.max(-1, ...categoryRows.map((c) => c.sort)) + 1 })
          .returning({ id: categories.id });
        categoryId.set(name, row.id);
      }

      const groupRows = await tx.select({ id: modifierGroups.id, name: modifierGroups.name })
        .from(modifierGroups).where(eq(modifierGroups.shopId, shop.id));
      const groupId = new Map(groupRows.map((row) => [row.name, row.id]));
      const existing = await tx.select({ id: products.id, name: products.name, imageUrl: products.imageUrl })
        .from(products).where(eq(products.shopId, shop.id));
      const byName = new Map(existing.map((row) => [row.name, row]));
      const [{ maxSort }] = await tx.select({ maxSort: max(products.sort) }).from(products).where(eq(products.shopId, shop.id));
      let sort = (maxSort ?? -1) + 1;

      for (const item of MENU_CATALOG) {
        const found = byName.get(item.name);
        if (found) {
          if (!found.imageUrl) {
            await tx.update(products).set({ imageUrl: menuImageSrc(item.slug) })
              .where(and(eq(products.shopId, shop.id), eq(products.id, found.id)));
            imaged += 1;
          }
          continue;
        }
        const [product] = await tx.insert(products).values({
          shopId: shop.id, categoryId: categoryId.get(item.category), name: item.name,
          basePriceSatang: item.priceSatang, imageUrl: menuImageSrc(item.slug), earnsStamp: item.kind !== "bakery", sort: sort++,
        }).returning({ id: products.id });
        const links = groupsForKind[item.kind].flatMap((name, index) => {
          const id = groupId.get(name);
          return id ? [{ productId: product.id, groupId: id, sort: index }] : [];
        });
        if (links.length) await tx.insert(productModifierGroups).values(links);
        added += 1;
      }
    });
    console.info(`Stock menu: ${added} products added, ${imaged} existing products got a photo.`);
  } finally {
    await client.end();
  }
}

seedMenu().catch((error: unknown) => {
  console.error("Menu seed failed:", error);
  process.exitCode = 1;
});
