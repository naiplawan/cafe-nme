import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, modifierGroups, modifiers, productModifierGroups, products } from "@/db/schema";
import { MENU_CATALOG } from "@/lib/menu-catalog";

export async function listModifierGroups(shopId: string) {
  const groups = await db
    .select({
      id: modifierGroups.id,
      name: modifierGroups.name,
      minSelect: modifierGroups.minSelect,
      maxSelect: modifierGroups.maxSelect,
      sort: modifierGroups.sort,
    })
    .from(modifierGroups)
    .where(eq(modifierGroups.shopId, shopId))
    .orderBy(asc(modifierGroups.sort), asc(modifierGroups.name));

  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const [options, assignments] = await Promise.all([
    db
      .select({
        id: modifiers.id,
        groupId: modifiers.groupId,
        name: modifiers.name,
        priceDeltaSatang: modifiers.priceDeltaSatang,
        sort: modifiers.sort,
      })
      .from(modifiers)
      .where(inArray(modifiers.groupId, groupIds))
      .orderBy(asc(modifiers.sort), asc(modifiers.name)),
    db
      .select({ groupId: productModifierGroups.groupId, productId: products.id, productName: products.name })
      .from(productModifierGroups)
      .innerJoin(products, and(eq(products.id, productModifierGroups.productId), eq(products.shopId, shopId)))
      .where(inArray(productModifierGroups.groupId, groupIds))
      .orderBy(asc(products.name)),
  ]);

  return groups.map((group) => ({
    ...group,
    modifiers: options.filter((option) => option.groupId === group.id),
    productIds: assignments.filter((assignment) => assignment.groupId === group.id).map((assignment) => assignment.productId),
    productNames: assignments.filter((assignment) => assignment.groupId === group.id).map((assignment) => assignment.productName),
  }));
}

export async function createModifierGroup(
  shopId: string,
  input: { name: string; minSelect: number; maxSelect: number },
) {
  const [group] = await db
    .insert(modifierGroups)
    .values({ shopId, ...input })
    .returning({ id: modifierGroups.id });
  return group;
}

const standardModifierGroups = [
  { name: "ความหวาน", minSelect: 1, maxSelect: 1, modifiers: [{ name: "0%", priceDeltaSatang: 0 }, { name: "25%", priceDeltaSatang: 0 }, { name: "50%", priceDeltaSatang: 0 }, { name: "100%", priceDeltaSatang: 0 }] },
  { name: "ประเภท", minSelect: 1, maxSelect: 1, modifiers: [{ name: "ร้อน", priceDeltaSatang: 0 }, { name: "เย็น", priceDeltaSatang: 500 }, { name: "ปั่น", priceDeltaSatang: 1000 }] },
  { name: "นม", minSelect: 0, maxSelect: 1, modifiers: [{ name: "นมโอ๊ต", priceDeltaSatang: 1500 }, { name: "นมอัลมอนด์", priceDeltaSatang: 1500 }] },
  { name: "ช็อตเพิ่ม", minSelect: 0, maxSelect: 2, modifiers: [{ name: "เพิ่มช็อต", priceDeltaSatang: 1500 }] },
] as const;

export async function createStandardModifierGroups(shopId: string) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ name: modifierGroups.name })
      .from(modifierGroups)
      .where(eq(modifierGroups.shopId, shopId));
    const existingNames = new Set(existing.map((group) => group.name));
    const createdGroups = new Map<string, string>();

    for (const preset of standardModifierGroups) {
      if (existingNames.has(preset.name)) continue;
      const [group] = await tx
        .insert(modifierGroups)
        .values({ shopId, name: preset.name, minSelect: preset.minSelect, maxSelect: preset.maxSelect })
        .returning({ id: modifierGroups.id });
      await tx.insert(modifiers).values(preset.modifiers.map((modifier, sort) => ({ ...modifier, groupId: group.id, sort })));
      createdGroups.set(preset.name, group.id);
    }

    if (createdGroups.size === 0) return { created: 0, linkedProducts: 0 };
    const shopProducts = await tx
      .select({ id: products.id, name: products.name, categoryName: categories.name })
      .from(products)
      .leftJoin(categories, and(eq(products.categoryId, categories.id), eq(categories.shopId, shopId)))
      .where(eq(products.shopId, shopId));
    const catalogByName = new Map(MENU_CATALOG.map((item) => [item.name, item.kind]));
    const groupsByKind = {
      coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
      milk: ["ความหวาน", "ประเภท", "นม"],
      drink: ["ความหวาน", "ประเภท"],
      bakery: [],
      other: ["ความหวาน", "ประเภท"],
    } as const;
    const groupIdsByProduct = shopProducts.map((product) => {
      const kind = catalogByName.get(product.name) ?? (product.categoryName === "เบเกอรี่" ? "bakery" : "other");
      return groupsByKind[kind].flatMap((name) => {
        const groupId = createdGroups.get(name);
        return groupId ? [groupId] : [];
      });
    });
    const productIdsWithNewGroups = shopProducts
      .filter((_product, index) => groupIdsByProduct[index].length > 0)
      .map((product) => product.id);
    const existingAssignments = productIdsWithNewGroups.length > 0
      ? await tx
        .select({ productId: productModifierGroups.productId, maxSort: sql<number>`max(${productModifierGroups.sort})` })
        .from(productModifierGroups)
        .where(inArray(productModifierGroups.productId, productIdsWithNewGroups))
        .groupBy(productModifierGroups.productId)
      : [];
    const sortByProduct = new Map(existingAssignments.map((row) => [row.productId, Number(row.maxSort) + 1]));
    const assignments = shopProducts.flatMap((product, index) =>
      groupIdsByProduct[index].map((groupId, sort) => ({ productId: product.id, groupId, sort: (sortByProduct.get(product.id) ?? 0) + sort })),
    );
    if (assignments.length > 0) await tx.insert(productModifierGroups).values(assignments);
    const linkedProducts = new Set(assignments.map((assignment) => assignment.productId)).size;
    return { created: createdGroups.size, linkedProducts };
  });
}

export async function setGroupProducts(shopId: string, groupId: string, productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds)];
  await db.transaction(async (tx) => {
    const [group] = await tx
      .select({ id: modifierGroups.id })
      .from(modifierGroups)
      .where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.shopId, shopId)))
      .limit(1);
    if (!group) throw new Error("Modifier group not found");

    if (uniqueProductIds.length > 0) {
      const ownedProducts = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.shopId, shopId), inArray(products.id, uniqueProductIds)));
      if (ownedProducts.length !== uniqueProductIds.length) throw new Error("Product not found");
    }

    await tx.delete(productModifierGroups).where(eq(productModifierGroups.groupId, groupId));
    if (uniqueProductIds.length === 0) return;

    const existing = await tx
      .select({ productId: productModifierGroups.productId, maxSort: sql<number>`max(${productModifierGroups.sort})` })
      .from(productModifierGroups)
      .where(inArray(productModifierGroups.productId, uniqueProductIds))
      .groupBy(productModifierGroups.productId);
    const sortByProduct = new Map(existing.map((row) => [row.productId, Number(row.maxSort) + 1]));
    await tx.insert(productModifierGroups).values(uniqueProductIds.map((productId) => ({
      productId,
      groupId,
      sort: sortByProduct.get(productId) ?? 0,
    })));
  });
}

export async function updateModifierGroup(
  shopId: string,
  groupId: string,
  input: { name: string; minSelect: number; maxSelect: number },
) {
  await db
    .update(modifierGroups)
    .set(input)
    .where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.shopId, shopId)));
}

export async function deleteModifierGroup(shopId: string, groupId: string) {
  await db
    .delete(modifierGroups)
    .where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.shopId, shopId)));
}

export async function createModifier(
  shopId: string,
  groupId: string,
  input: { name: string; priceDeltaSatang: number },
) {
  const [group] = await db
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.shopId, shopId)))
    .limit(1);

  if (!group) throw new Error("Modifier group not found");

  const [modifier] = await db
    .insert(modifiers)
    .values({ groupId, ...input })
    .returning({ id: modifiers.id });
  return modifier;
}

async function getOwnedModifierGroupId(shopId: string, modifierId: string) {
  const [row] = await db
    .select({ groupId: modifiers.groupId })
    .from(modifiers)
    .innerJoin(modifierGroups, eq(modifiers.groupId, modifierGroups.id))
    .where(and(eq(modifiers.id, modifierId), eq(modifierGroups.shopId, shopId)))
    .limit(1);

  if (!row) throw new Error("Modifier not found");
  return row.groupId;
}

export async function updateModifier(
  shopId: string,
  modifierId: string,
  input: { name: string; priceDeltaSatang: number },
) {
  const groupId = await getOwnedModifierGroupId(shopId, modifierId);
  await db
    .update(modifiers)
    .set(input)
    .where(and(eq(modifiers.id, modifierId), eq(modifiers.groupId, groupId)));
}

export async function deleteModifier(shopId: string, modifierId: string) {
  const groupId = await getOwnedModifierGroupId(shopId, modifierId);
  await db
    .delete(modifiers)
    .where(and(eq(modifiers.id, modifierId), eq(modifiers.groupId, groupId)));
}
