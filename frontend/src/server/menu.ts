import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

export type ProductInput = {
  name: string;
  price: number;
  categoryId: string | null;
  imageUrl: string | null;
  tileColor?: string | null;
  earnsStamp: boolean;
  isActive: boolean;
};

const TRAILING_SLASH = /\/$/;
const categorySchema = z.object({
  id: z.uuid(),
  shopId: z.uuid(),
  name: z.string(),
  sort: z.number().int(),
});
const productListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  basePriceSatang: z.number().int(),
  imageUrl: z.string().nullable(),
  tileColor: z.string().nullable(),
  isActive: z.boolean(),
  soldOut: z.boolean(),
  earnsStamp: z.boolean(),
  categoryId: z.uuid().nullable(),
  categoryName: z.string().nullable(),
});
const modifierGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  minSelect: z.number().int(),
  maxSelect: z.number().int(),
  modifierNames: z.array(z.string()),
});
const menuSettingsSchema = z.object({ autoClearSoldOut: z.boolean() });
const menuSchema = z.object({
  categories: z.array(categorySchema),
  products: z.array(productListItemSchema),
  modifierGroups: z.array(modifierGroupSchema),
  settings: menuSettingsSchema,
});
const productRowSchema = z.object({
  id: z.uuid(),
  shopId: z.uuid(),
  categoryId: z.uuid().nullable(),
  name: z.string(),
  basePriceSatang: z.number().int(),
  imageUrl: z.string().nullable(),
  tileColor: z.string().nullable(),
  isActive: z.boolean(),
  soldOut: z.boolean(),
  earnsStamp: z.boolean(),
  sort: z.number().int(),
  createdAt: z.union([z.date(), z.iso.datetime()]),
});
const productDetailSchema = productRowSchema.extend({
  modifierGroupIds: z.array(z.uuid()),
});
const idRowSchema = z.object({ id: z.uuid() });
const importResultSchema = z.object({ added: z.number().int(), linkedProducts: z.number().int() });

type Menu = z.infer<typeof menuSchema>;
type ProductRow = z.infer<typeof productRowSchema> & { createdAt: Date };
type ProductDetail = z.infer<typeof productDetailSchema> & { createdAt: Date };

const STOCK_MENU_MODIFIER_GROUPS = {
  coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
  milk: ["ความหวาน", "ประเภท", "นม"],
  drink: ["ความหวาน", "ประเภท"],
  bakery: [],
} as const;

export function stockMenuModifierGroupNames(kind: keyof typeof STOCK_MENU_MODIFIER_GROUPS) {
  return STOCK_MENU_MODIFIER_GROUPS[kind];
}

function menuUrl(shopId: string, suffix = "") {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) throw new Error("API_BASE_URL is required to manage the menu");
  return `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(shopId)}/menu${suffix}`;
}

async function requestMenu<T>(shopId: string, suffix: string, options: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(menuUrl(shopId, suffix), {
    ...options,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nest menu API returned ${response.status}`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest menu API returned an invalid payload");
  return parsed.data;
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

function patchBody(body: unknown): RequestInit {
  return { method: "PATCH", body: JSON.stringify(body) };
}

const getMenu = cache(async (shopId: string): Promise<Menu> => {
  return requestMenu(shopId, "", { method: "GET" }, menuSchema);
});

export async function importStockMenu(shopId: string) {
  return requestMenu(shopId, "/products/import-stock", jsonBody({}), importResultSchema);
}

export async function listCategories(shopId: string) {
  return (await getMenu(shopId)).categories;
}

export async function categoryNameExists(shopId: string, name: string, excludeCategoryId?: string) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return (await listCategories(shopId)).some((category) =>
    category.id !== excludeCategoryId && category.name.trim().toLocaleLowerCase() === normalizedName
  );
}

export async function createCategory(shopId: string, name: string) {
  return requestMenu(shopId, "/categories", jsonBody({ name }), z.array(categorySchema));
}

export async function renameCategory(shopId: string, categoryId: string, name: string) {
  return requestMenu(shopId, `/categories/${encodeURIComponent(categoryId)}`, patchBody({ name }), z.array(categorySchema));
}

export async function deleteCategory(shopId: string, categoryId: string) {
  return requestMenu(shopId, `/categories/${encodeURIComponent(categoryId)}`, { method: "DELETE" }, z.array(idRowSchema));
}

export async function listProducts(shopId: string) {
  return (await getMenu(shopId)).products;
}

export async function getProduct(shopId: string, productId: string): Promise<ProductDetail | null> {
  const response = await fetch(menuUrl(shopId, `/products/${encodeURIComponent(productId)}`), {
    headers: { "x-internal-api-token": createInternalApiToken() },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Nest menu API returned ${response.status}`);
  const parsed = productDetailSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest menu API returned an invalid product payload");
  return { ...parsed.data, createdAt: new Date(parsed.data.createdAt) };
}

export async function listModifierGroupsForShop(shopId: string) {
  return (await getMenu(shopId)).modifierGroups;
}

export async function createProduct(shopId: string, input: ProductInput, modifierGroupIds: string[] = []) {
  const rows = await requestMenu(shopId, "/products", jsonBody({ ...input, modifierGroupIds }), z.array(productRowSchema));
  return rows.map((row): ProductRow => ({ ...row, createdAt: new Date(row.createdAt) }));
}

export async function updateProduct(shopId: string, productId: string, input: ProductInput) {
  const current = await getProduct(shopId, productId);
  if (!current) return [];
  return updateProductWithModifierGroups(shopId, productId, input, current.modifierGroupIds);
}

export async function updateProductWithModifierGroups(
  shopId: string,
  productId: string,
  input: ProductInput,
  modifierGroupIds: string[],
) {
  return requestMenu(
    shopId,
    `/products/${encodeURIComponent(productId)}`,
    patchBody({ ...input, modifierGroupIds }),
    z.array(idRowSchema),
  );
}

export async function setProductsActive(shopId: string, productIds: string[], isActive: boolean) {
  if (productIds.length === 0) return [];
  return requestMenu(shopId, "/products/bulk", jsonBody({ productIds, isActive }), z.array(idRowSchema));
}

export async function restoreProductsForSale(shopId: string, productIds: string[]) {
  if (productIds.length === 0) return [];
  return requestMenu(shopId, "/products/bulk", jsonBody({ productIds, restoreForSale: true }), z.array(idRowSchema));
}

export async function updateProductsModifierGroup(shopId: string, productIds: string[], action: "add" | "remove", modifierGroupId: string) {
  if (productIds.length === 0) return [];
  return requestMenu(shopId, "/products/bulk", jsonBody({ productIds, modifierGroupAction: action, modifierGroupId }), z.array(idRowSchema));
}

export async function reorderCategories(shopId: string, categoryIds: string[]) {
  return requestMenu(shopId, "/categories/reorder", jsonBody({ categoryIds }), z.array(idRowSchema));
}

export async function reorderProducts(shopId: string, productIds: string[]) {
  return requestMenu(shopId, "/products/reorder", jsonBody({ productIds }), z.array(idRowSchema));
}

export async function getMenuSettings(shopId: string) {
  return (await getMenu(shopId)).settings;
}

export async function updateMenuSettings(shopId: string, autoClearSoldOut: boolean) {
  return requestMenu(shopId, "/settings", patchBody({ autoClearSoldOut }), menuSettingsSchema);
}

export async function clearSoldOutProducts(shopId: string) {
  return requestMenu(shopId, "/products/clear-sold-out", jsonBody({}), z.array(idRowSchema));
}

export async function deleteProduct(shopId: string, productId: string) {
  return requestMenu(shopId, `/products/${encodeURIComponent(productId)}`, { method: "DELETE" }, z.array(idRowSchema));
}

export async function setProductModifierGroups(shopId: string, productId: string, groupIds: string[]) {
  const current = await getProduct(shopId, productId);
  if (!current) throw new Error("Product not found");
  return updateProductWithModifierGroups(shopId, productId, {
    name: current.name,
    price: current.basePriceSatang,
    categoryId: current.categoryId,
    imageUrl: current.imageUrl,
    tileColor: current.tileColor,
    earnsStamp: current.earnsStamp,
    isActive: current.isActive,
  }, groupIds);
}
