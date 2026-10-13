"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createCategory,
  createProduct,
  clearSoldOutProducts,
  deleteCategory,
  deleteProduct,
  importStockMenu,
  renameCategory,
  setProductsActive,
  setProductModifierGroups,
  updateProduct,
} from "@/server/menu";
import { requireStaff } from "@/lib/auth";
import {
  categorySchema,
  productSchema,
} from "@/lib/validation/menu";

export type MenuActionState = {
  message: string | null;
  success?: boolean;
  values?: Record<string, string | boolean | string[]>;
  revision?: string;
};
const uuidSchema = z.uuid();

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createCategoryAction(
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  const parsed = categorySchema.safeParse({ name: textField(formData, "name") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  await createCategory(shopId, parsed.data.name);
  revalidatePath("/admin/menu");
  return { message: null, success: true };
}

export async function renameCategoryAction(
  categoryId: string,
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  if (!uuidSchema.safeParse(categoryId).success) return { message: "หมวดหมู่ไม่ถูกต้อง" };
  const parsed = categorySchema.safeParse({ name: textField(formData, "name") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  await renameCategory(shopId, categoryId, parsed.data.name);
  revalidatePath("/admin/menu");
  return { message: null, success: true };
}

export async function deleteCategoryAction(categoryId: string) {
  const { shopId } = await requireStaff();
  if (!uuidSchema.safeParse(categoryId).success) return;
  await deleteCategory(shopId, categoryId);
  revalidatePath("/admin/menu");
}

function parseProduct(formData: FormData) {
  const values = {
    name: textField(formData, "name"),
    price: textField(formData, "price"),
    categoryId: textField(formData, "categoryId"),
    imageUrl: textField(formData, "imageUrl"),
    earnsStamp: textField(formData, "earnsStamp"),
    isActive: textField(formData, "isActive"),
  };
  return { values, parsed: productSchema.safeParse({
    ...values,
    earnsStamp: values.earnsStamp || undefined,
    isActive: values.isActive || undefined,
  }) };
}

export async function createProductAction(
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  const { values, parsed } = parseProduct(formData);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values, revision: crypto.randomUUID() };
  await createProduct(shopId, parsed.data);
  revalidatePath("/admin/menu");
  return { message: null, success: true };
}

export async function updateProductAction(
  productId: string,
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  if (!uuidSchema.safeParse(productId).success) return { message: "สินค้าไม่ถูกต้อง" };
  const { values, parsed } = parseProduct(formData);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values: { ...values, modifierGroupIds: formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string") }, revision: crypto.randomUUID() };
  const groupIds = z.array(uuidSchema).safeParse(formData.getAll("modifierGroupIds"));
  if (!groupIds.success) return { message: "กลุ่มตัวเลือกไม่ถูกต้อง", values: { ...values, modifierGroupIds: formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string") }, revision: crypto.randomUUID() };

  const updated = await updateProduct(shopId, productId, parsed.data);
  if (updated.length === 0) return { message: "ไม่พบสินค้า" };
  await setProductModifierGroups(shopId, productId, groupIds.data);
  revalidatePath("/admin/menu");
  revalidatePath(`/admin/menu/${productId}`);
  return { message: null, success: true };
}

export async function importStockMenuAction(
  _previous: MenuActionState,
  _formData: FormData,
): Promise<MenuActionState> {
  void _previous;
  void _formData;
  const { shopId } = await requireStaff();
  const { added, linkedProducts } = await importStockMenu(shopId);
  revalidatePath("/admin/menu");
  return {
    message: linkedProducts > 0
      ? `เพิ่ม ${added} รายการ · ผูกตัวเลือกเสริมให้แล้ว`
      : `เพิ่ม ${added} รายการแล้ว`,
    success: true,
  };
}

export async function deleteProductAction(productId: string, _formData: FormData) {
  void _formData;
  const { shopId } = await requireStaff();
  if (!uuidSchema.safeParse(productId).success) return;
  await deleteProduct(shopId, productId);
  revalidatePath("/admin/menu");
  redirect("/admin/menu");
}

export async function bulkUpdateProductsAction(
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  const ids = z.array(uuidSchema).min(1).max(200).safeParse(formData.getAll("productIds"));
  const isActiveValue = textField(formData, "isActive");
  if (!ids.success) return { message: ids.error.issues[0]?.message ?? "เลือกสินค้าอย่างน้อย 1 รายการ" };
  if (isActiveValue !== "true" && isActiveValue !== "false") return { message: "กรุณาเลือกสถานะสินค้า" };
  const changed = await setProductsActive(shopId, [...new Set(ids.data)], isActiveValue === "true");
  revalidatePath("/admin/menu");
  return { message: `ปรับสถานะแล้ว ${changed.length} รายการ` };
}

export async function clearSoldOutProductsAction(
  _previous: MenuActionState,
  _formData: FormData,
): Promise<MenuActionState> {
  void _previous;
  void _formData;
  const { shopId } = await requireStaff();
  const cleared = await clearSoldOutProducts(shopId);
  revalidatePath("/admin/menu");
  return { message: `เปิดขายแล้ว ${cleared.length} รายการ` };
}
