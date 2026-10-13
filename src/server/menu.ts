import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { MENU_CATALOG, menuImageSrc } from "@/lib/menu-catalog";
import {
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
} from "@/db/schema";

export type ProductInput = {
  name: string;
  price: number;
  categoryId: string | null;
  imageUrl: string | null;
  earnsStamp: boolean;
  isActive: boolean;
};

const STOCK_MENU_MODIFIER_GROUPS = {
  coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
  milk: ["ความหวาน", "ประเภท", "นม"],
  drink: ["ความหวาน", "ประเภท"],
  bakery: [],
} as const;

export function stockMenuModifierGroupNames(kind: (typeof MENU_CATALOG)[number]["kind"]) {
  return STOCK_MENU_MODIFIER_GROUPS[kind];
}

export async function importStockMenu(shopId: string) {
  return db.transaction(async (tx) => {
    const categoryRows = await tx
      .select({ id: categories.id, name: categories.name, sort: categories.sort })
      .from(categories)
      .where(eq(categories.shopId, shopId));
    const categoryId = new Map(categoryRows.map((row) => [row.name, row.id]));
    let categorySort = Math.max(-1, ...categoryRows.map((row) => row.sort)) + 1;

    for (const name of new Set(MENU_CATALOG.map((item) => item.category))) {
      if (categoryId.has(name)) continue;
      const [row] = await tx
        .insert(categories)
        .values({ shopId, name, sort: categorySort++ })
        .returning({ id: categories.id });
      categoryId.set(name, row.id);
    }

    const existing = await tx
      .select({ name: products.name })
      .from(products)
      .where(eq(products.shopId, shopId));
    const existingNames = new Set(existing.map((product) => product.name));
    const shopModifierGroups = await tx
      .select({ id: modifierGroups.id, name: modifierGroups.name })
      .from(modifierGroups)
      .where(eq(modifierGroups.shopId, shopId))
      .orderBy(asc(modifierGroups.sort), asc(modifierGroups.name));
    const modifierGroupId = new Map<string, string>();
    for (const group of shopModifierGroups) {
      if (!modifierGroupId.has(group.name)) modifierGroupId.set(group.name, group.id);
    }
    const [{ maxSort }] = await tx
      .select({ maxSort: sql<number | null>`max(${products.sort})` })
      .from(products)
      .where(eq(products.shopId, shopId));
    let sort = (maxSort ?? -1) + 1;
    let added = 0;
    let linkedProducts = 0;
    const productGroupLinks: { productId: string; groupId: string; sort: number }[] = [];

    for (const item of MENU_CATALOG) {
      if (existingNames.has(item.name)) continue;
      const [product] = await tx.insert(products).values({
          shopId,
          categoryId: categoryId.get(item.category) ?? null,
          name: item.name,
          basePriceSatang: item.priceSatang,
          imageUrl: menuImageSrc(item.slug),
          earnsStamp: item.kind !== "bakery",
          isActive: true,
          sort: sort++,
        })
        .returning({ id: products.id });
      const groupIds = stockMenuModifierGroupNames(item.kind)
        .flatMap((name) => {
          const id = modifierGroupId.get(name);
          return id ? [id] : [];
        });
      if (groupIds.length > 0) {
        linkedProducts += 1;
        productGroupLinks.push(...groupIds.map((groupId, groupSort) => ({
          productId: product.id,
          groupId,
          sort: groupSort,
        })));
      }
      added += 1;
    }
    if (productGroupLinks.length > 0) {
      await tx.insert(productModifierGroups).values(productGroupLinks);
    }
    return { added, linkedProducts };
  });
}

export async function listCategories(shopId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.shopId, shopId))
    .orderBy(asc(categories.sort), asc(categories.name));
}

export async function createCategory(shopId: string, name: string) {
  const [highest] = await db
    .select({ sort: categories.sort })
    .from(categories)
    .where(eq(categories.shopId, shopId))
    .orderBy(sql`${categories.sort} desc`)
    .limit(1);
  return db
    .insert(categories)
    .values({ shopId, name, sort: highest ? highest.sort + 1 : 0 })
    .returning();
}

export async function renameCategory(shopId: string, categoryId: string, name: string) {
  return db
    .update(categories)
    .set({ name })
    .where(and(eq(categories.id, categoryId), eq(categories.shopId, shopId)))
    .returning();
}

export async function deleteCategory(shopId: string, categoryId: string) {
  return db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.shopId, shopId)))
    .returning({ id: categories.id });
}

export async function listProducts(shopId: string) {
  return db
    .select({
      id: products.id,
      name: products.name,
      basePriceSatang: products.basePriceSatang,
      imageUrl: products.imageUrl,
      isActive: products.isActive,
      soldOut: products.soldOut,
      earnsStamp: products.earnsStamp,
      categoryId: products.categoryId,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(
      categories,
      and(eq(products.categoryId, categories.id), eq(categories.shopId, shopId)),
    )
    .where(eq(products.shopId, shopId))
    .orderBy(
      sql`coalesce(${categories.sort}, 2147483647)`,
      asc(products.sort),
      asc(products.name),
    );
}

export async function getProduct(shopId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
    .limit(1);
  if (!product) return null;

  const assignedGroups = await db
    .select({ groupId: productModifierGroups.groupId })
    .from(productModifierGroups)
    .innerJoin(modifierGroups, eq(productModifierGroups.groupId, modifierGroups.id))
    .where(and(eq(productModifierGroups.productId, productId), eq(modifierGroups.shopId, shopId)))
    .orderBy(asc(productModifierGroups.sort));

  return { ...product, modifierGroupIds: assignedGroups.map(({ groupId }) => groupId) };
}

async function ensureCategoryBelongsToShop(shopId: string, categoryId: string | null) {
  if (!categoryId) return;
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.shopId, shopId)))
    .limit(1);
  if (!category) throw new Error("Category not found");
}

export async function createProduct(shopId: string, input: ProductInput) {
  await ensureCategoryBelongsToShop(shopId, input.categoryId);
  return db
    .insert(products)
    .values({
      shopId,
      categoryId: input.categoryId,
      name: input.name,
      basePriceSatang: input.price,
      imageUrl: input.imageUrl,
      earnsStamp: input.earnsStamp,
      isActive: input.isActive,
    })
    .returning();
}

export async function updateProduct(shopId: string, productId: string, input: ProductInput) {
  await ensureCategoryBelongsToShop(shopId, input.categoryId);
  return db
    .update(products)
    .set({
      categoryId: input.categoryId,
      name: input.name,
      basePriceSatang: input.price,
      imageUrl: input.imageUrl,
      earnsStamp: input.earnsStamp,
      isActive: input.isActive,
    })
    .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
    .returning({ id: products.id });
}

export async function setProductsActive(shopId: string, productIds: string[], isActive: boolean) {
  if (productIds.length === 0) return [];
  return db
    .update(products)
    .set({ isActive })
    .where(and(eq(products.shopId, shopId), inArray(products.id, productIds)))
    .returning({ id: products.id });
}

export async function clearSoldOutProducts(shopId: string) {
  return db
    .update(products)
    .set({ soldOut: false })
    .where(and(eq(products.shopId, shopId), eq(products.soldOut, true)))
    .returning({ id: products.id });
}

export async function deleteProduct(shopId: string, productId: string) {
  return db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
    .returning({ id: products.id });
}

export async function listModifierGroupsForShop(shopId: string) {
  const rows = await db
    .select({
      id: modifierGroups.id,
      name: modifierGroups.name,
      minSelect: modifierGroups.minSelect,
      maxSelect: modifierGroups.maxSelect,
      modifierName: modifiers.name,
      modifierSort: modifiers.sort,
    })
    .from(modifierGroups)
    .leftJoin(modifiers, eq(modifiers.groupId, modifierGroups.id))
    .where(eq(modifierGroups.shopId, shopId))
    .orderBy(asc(modifierGroups.sort), asc(modifierGroups.name), asc(modifiers.sort));

  const groups = new Map<
    string,
    { id: string; name: string; minSelect: number; maxSelect: number; modifierNames: string[] }
  >();
  for (const row of rows) {
    const group = groups.get(row.id) ?? {
      id: row.id,
      name: row.name,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      modifierNames: [],
    };
    if (row.modifierName) group.modifierNames.push(row.modifierName);
    groups.set(row.id, group);
  }
  return [...groups.values()];
}

export async function setProductModifierGroups(
  shopId: string,
  productId: string,
  groupIds: string[],
) {
  const uniqueGroupIds = [...new Set(groupIds)];
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
      .limit(1);
    if (!product) throw new Error("Product not found");

    if (uniqueGroupIds.length > 0) {
      const ownedGroups = await tx
        .select({ id: modifierGroups.id })
        .from(modifierGroups)
        .where(and(eq(modifierGroups.shopId, shopId), inArray(modifierGroups.id, uniqueGroupIds)));
      if (ownedGroups.length !== uniqueGroupIds.length) throw new Error("Modifier group not found");
    }

    await tx
      .delete(productModifierGroups)
      .where(eq(productModifierGroups.productId, productId));
    if (uniqueGroupIds.length === 0) return;
    await tx.insert(productModifierGroups).values(
      uniqueGroupIds.map((groupId, sort) => ({ productId, groupId, sort })),
    );
  });
}
