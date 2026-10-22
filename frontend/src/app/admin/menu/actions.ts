"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { requireStaff } from "@/lib/auth";
import {
  categorySchema,
  modifierGroupIdsSchema,
  productSchema,
} from "@/lib/validation/menu";
import {
  categoryNameExists,
  clearSoldOutProducts,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  importStockMenu,
  renameCategory,
  reorderCategories,
  reorderProducts,
  restoreProductsForSale,
  setProductsActive,
  updateMenuSettings,
  updateProductsModifierGroup,
  updateProductWithModifierGroups,
} from "@/server/menu";

export type MenuActionState = {
  message: string | null;
  success?: boolean;
  values?: Record<string, string | boolean | string[]>;
  revision?: string;
  /** Id of the row a create action just inserted. */
  id?: string;
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
  try {
    const parsed = categorySchema.safeParse({ name: textField(formData, "name") });
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    if (await categoryNameExists(shopId, parsed.data.name)) return { message: "มีหมวดหมู่นี้แล้ว" };
    const [created] = await createCategory(shopId, parsed.data.name);
    revalidatePath("/admin/menu");
    return { message: null, success: true, id: created?.id };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

export async function renameCategoryAction(
  categoryId: string,
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  try {
    if (!uuidSchema.safeParse(categoryId).success) return { message: "หมวดหมู่ไม่ถูกต้อง" };
    const parsed = categorySchema.safeParse({ name: textField(formData, "name") });
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    if (await categoryNameExists(shopId, parsed.data.name, categoryId)) return { message: "มีหมวดหมู่นี้แล้ว" };
    await renameCategory(shopId, categoryId, parsed.data.name);
    revalidatePath("/admin/menu");
    return { message: null, success: true };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

export async function deleteCategoryAction(categoryId: string, _previous: MenuActionState, _formData: FormData): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  try {
    if (!uuidSchema.safeParse(categoryId).success) return { message: "หมวดหมู่ไม่ถูกต้อง" };
    await deleteCategory(shopId, categoryId);
    revalidatePath("/admin/menu");
    return { message: null, success: true };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

function parseProduct(formData: FormData) {
  const values = {
    name: textField(formData, "name"),
    price: textField(formData, "price"),
    categoryId: textField(formData, "categoryId"),
    imageUrl: textField(formData, "imageUrl"),
    tileColor: textField(formData, "tileColor"),
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
  try {
    const { values, parsed } = parseProduct(formData);
    const modifierGroupIds = formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string");
    const parsedModifierGroupIds = modifierGroupIdsSchema.safeParse(modifierGroupIds);
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values: { ...values, modifierGroupIds }, revision: crypto.randomUUID() };
    if (!parsedModifierGroupIds.success) return { message: "กลุ่มตัวเลือกไม่ถูกต้อง", values: { ...values, modifierGroupIds }, revision: crypto.randomUUID() };
    const [created] = await createProduct(shopId, parsed.data, parsedModifierGroupIds.data);
    revalidatePath("/admin/menu");
    return { message: `เพิ่ม “${parsed.data.name}” แล้ว`, success: true, id: created?.id };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่", values: { ...parseProduct(formData).values, modifierGroupIds: formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string") }, revision: crypto.randomUUID() };
  }
}

export async function updateProductAction(
  productId: string,
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  try {
    if (!uuidSchema.safeParse(productId).success) return { message: "สินค้าไม่ถูกต้อง" };
    const { values, parsed } = parseProduct(formData);
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values: { ...values, modifierGroupIds: formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string") }, revision: crypto.randomUUID() };
    const modifierGroupIds = formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string");
    const groupIds = modifierGroupIdsSchema.safeParse(modifierGroupIds);
    if (!groupIds.success) return { message: "กลุ่มตัวเลือกไม่ถูกต้อง", values: { ...values, modifierGroupIds }, revision: crypto.randomUUID() };

    const updated = await updateProductWithModifierGroups(shopId, productId, parsed.data, groupIds.data);
    if (updated.length === 0) return { message: "ไม่พบสินค้า" };
    revalidatePath("/admin/menu");
    revalidatePath(`/admin/menu/${productId}`);
    return { message: null, success: true };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่", values: { ...parseProduct(formData).values, modifierGroupIds: formData.getAll("modifierGroupIds").filter((id): id is string => typeof id === "string") }, revision: crypto.randomUUID() };
  }
}

export async function importStockMenuAction(
  _previous: MenuActionState,
  _formData: FormData,
): Promise<MenuActionState> {
  void _previous;
  void _formData;
  const { shopId } = await requireStaff();
  try {
    const { added, linkedProducts } = await importStockMenu(shopId);
    revalidatePath("/admin/menu");
    return {
      message: linkedProducts > 0
        ? `เพิ่ม ${added} รายการ · ผูกตัวเลือกเสริมให้แล้ว`
        : `เพิ่ม ${added} รายการแล้ว`,
      success: true,
    };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

export async function deleteProductAction(productId: string, _previous: MenuActionState, _formData: FormData): Promise<MenuActionState> {
  void _formData;
  const { shopId } = await requireStaff();
  try {
    if (!uuidSchema.safeParse(productId).success) return { message: "สินค้าไม่ถูกต้อง" };
    await deleteProduct(shopId, productId);
    revalidatePath("/admin/menu");
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
  redirect("/admin/menu");
}

export async function bulkUpdateProductsAction(
  _previous: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  try {
    const ids = z.array(uuidSchema).min(1).max(200).safeParse(formData.getAll("productIds"));
    const restoreForSale = textField(formData, "restoreForSale") === "true";
    const isActiveValue = textField(formData, "isActive");
    if (!ids.success) return { message: ids.error.issues[0]?.message ?? "เลือกสินค้าอย่างน้อย 1 รายการ" };
    if (restoreForSale) {
      const restored = await restoreProductsForSale(shopId, [...new Set(ids.data)]);
      revalidatePath("/admin/menu");
      return { message: `เปิดขายแล้ว ${restored.length} รายการ` };
    }
    const modifierGroupAction = textField(formData, "modifierGroupAction");
    if (modifierGroupAction === "add" || modifierGroupAction === "remove") {
      const groupId = uuidSchema.safeParse(textField(formData, "modifierGroupId"));
      if (!groupId.success) return { message: "กรุณาเลือกกลุ่มตัวเลือก" };
      const changed = await updateProductsModifierGroup(shopId, [...new Set(ids.data)], modifierGroupAction, groupId.data);
      revalidatePath("/admin/menu");
      return { message: modifierGroupAction === "add" ? `เพิ่มกลุ่มตัวเลือกให้ ${changed.length} รายการ` : `เอากลุ่มตัวเลือกออกจาก ${changed.length} รายการ` };
    }
    if (isActiveValue !== "true" && isActiveValue !== "false") return { message: "กรุณาเลือกสถานะสินค้า" };
    const changed = await setProductsActive(shopId, [...new Set(ids.data)], isActiveValue === "true");
    revalidatePath("/admin/menu");
    return { message: `ปรับสถานะแล้ว ${changed.length} รายการ` };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

export async function clearSoldOutProductsAction(
  _previous: MenuActionState,
  _formData: FormData,
): Promise<MenuActionState> {
  void _previous;
  void _formData;
  const { shopId } = await requireStaff();
  try {
    const cleared = await clearSoldOutProducts(shopId);
    revalidatePath("/admin/menu");
    return { message: `เปิดขายแล้ว ${cleared.length} รายการ` };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}

export async function setAutoClearSoldOutAction(autoClearSoldOut: boolean) {
  const { shopId } = await requireStaff();
  try {
    await updateMenuSettings(shopId, autoClearSoldOut === true);
    revalidatePath("/admin/menu");
    return { message: null, success: true };
  } catch (error) {
    logger.error({ err: error, shopId }, "Menu mutation failed");
    return { success: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }
}


const idListSchema = z.array(uuidSchema).max(1000);

async function saveOrder(ids: unknown, save: (shopId: string, ids: string[]) => Promise<unknown>): Promise<MenuActionState> {
  const { shopId } = await requireStaff();
  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return { message: "ลำดับไม่ถูกต้อง" };
  try {
    await save(shopId, parsed.data);
  } catch {
    // The API rejects an order that no longer matches the menu (someone added or deleted an item meanwhile).
    return { message: "เมนูเปลี่ยนไประหว่างจัดลำดับ โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  }
  revalidatePath("/admin/menu");
  return { message: null, success: true };
}

export async function reorderCategoriesAction(categoryIds: string[]) {
  return saveOrder(categoryIds, reorderCategories);
}

export async function reorderProductsAction(productIds: string[]) {
  return saveOrder(productIds, reorderProducts);
}
