import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, modifierGroups, modifiers, productModifierGroups, products } from "@/db/schema";
import type { PosMenu } from "@/lib/pricing";

export async function getPosMenu(shopId: string): Promise<PosMenu> {
  const [categoryRows, productRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories)
      .where(eq(categories.shopId, shopId)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select({ id: products.id, name: products.name, categoryId: products.categoryId,
      basePriceSatang: products.basePriceSatang, imageUrl: products.imageUrl, earnsStamp: products.earnsStamp,
      soldOut: products.soldOut, sort: products.sort })
      .from(products).where(and(eq(products.shopId, shopId), eq(products.isActive, true)))
      .orderBy(asc(products.sort), asc(products.name)),
  ]);

  if (productRows.length === 0) return { categories: categoryRows, products: [] };
  const groupRows = await db.select({ productId: productModifierGroups.productId,
    id: modifierGroups.id, name: modifierGroups.name, minSelect: modifierGroups.minSelect, maxSelect: modifierGroups.maxSelect,
    modifierId: modifiers.id, modifierName: modifiers.name, priceDeltaSatang: modifiers.priceDeltaSatang,
    groupSort: productModifierGroups.sort, modifierSort: modifiers.sort })
    .from(productModifierGroups)
    .innerJoin(modifierGroups, and(eq(productModifierGroups.groupId, modifierGroups.id), eq(modifierGroups.shopId, shopId)))
    .leftJoin(modifiers, eq(modifiers.groupId, modifierGroups.id))
    .where(inArray(productModifierGroups.productId, productRows.map(({ id }) => id)))
    .orderBy(asc(productModifierGroups.sort), asc(modifierGroups.sort), asc(modifiers.sort));

  const assignments = new Map<string, Map<string, { id: string; name: string; minSelect: number; maxSelect: number; sort: number; modifiers: { id: string; name: string; priceDeltaSatang: number; sort: number }[] }>>();
  for (const row of groupRows) {
    const byGroup = assignments.get(row.productId) ?? new Map();
    const group = byGroup.get(row.id) ?? { id: row.id, name: row.name, minSelect: row.minSelect,
      maxSelect: row.maxSelect, sort: row.groupSort, modifiers: [] };
    if (row.modifierId && row.modifierName !== null && row.priceDeltaSatang !== null) {
      group.modifiers.push({ id: row.modifierId, name: row.modifierName,
        priceDeltaSatang: row.priceDeltaSatang, sort: row.modifierSort ?? 0 });
    }
    byGroup.set(row.id, group);
    assignments.set(row.productId, byGroup);
  }
  return { categories: categoryRows, products: productRows.map((product) => ({
    id: product.id, name: product.name, categoryId: product.categoryId,
    basePriceSatang: product.basePriceSatang, imageUrl: product.imageUrl, earnsStamp: product.earnsStamp,
    soldOut: product.soldOut,
    groups: [...(assignments.get(product.id)?.values() ?? [])].sort((a, b) => a.sort - b.sort)
      .filter((group) => group.modifiers.length > 0)
      .map((group) => ({ id: group.id, name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect,
        modifiers: group.modifiers.sort((a, b) => a.sort - b.sort)
          .map((option) => ({ id: option.id, name: option.name, priceDeltaSatang: option.priceDeltaSatang })) })),
  })) };
}
