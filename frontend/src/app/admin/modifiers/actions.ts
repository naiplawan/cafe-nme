"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import {
  modifierGroupSchema,
  modifierSchema,
} from "@/lib/validation/menu";
import {
  createModifier,
  createModifierGroup,
  createStandardModifierGroups,
  deleteModifier,
  deleteModifierGroup,
  setGroupProducts,
  updateModifierGroup,
} from "@/server/modifiers";

export interface ModifierFormValues {
  name?: string;
  minSelect?: string;
  maxSelect?: string;
  priceDelta?: string;
}
export interface ModifierFormState {
  error?: string;
  success?: boolean;
  createdGroupId?: string;
  message?: string;
  values?: ModifierFormValues;
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function groupValues(formData: FormData): ModifierFormValues {
  return {
    name: field(formData, "name"),
    minSelect: field(formData, "minSelect"),
    maxSelect: field(formData, "maxSelect"),
  };
}

function modifierValues(formData: FormData): ModifierFormValues {
  return {
    name: field(formData, "name"),
    priceDelta: field(formData, "priceDelta"),
  };
}

export async function createModifierGroupAction(
  _state: ModifierFormState,
  formData: FormData,
): Promise<ModifierFormState> {
  const session = await requireStaff();
  const values = groupValues(formData);
  const parsed = modifierGroupSchema.safeParse({
    ...values,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values };
  }

  let group: Awaited<ReturnType<typeof createModifierGroup>>;
  try {
    group = await createModifierGroup(session.shopId, parsed.data);
  } catch {
    return { error: "เพิ่มกลุ่มตัวเลือกไม่สำเร็จ กรุณาลองใหม่", values };
  }
  revalidatePath("/admin/modifiers");
  revalidatePath("/admin");
  return { success: true, createdGroupId: group.id };
}

export async function createStandardModifierGroupsAction(_state: ModifierFormState, _formData: FormData): Promise<ModifierFormState> {
  void _state;
  void _formData;
  const { shopId } = await requireStaff();
  const result = await createStandardModifierGroups(shopId);
  revalidatePath("/admin/modifiers");
  revalidatePath("/admin");
  // With no products yet there is nothing to link; the stock-menu import links these groups later.
  if (result.linkedProducts === 0) return { success: true, message: "เพิ่มชุดตัวเลือกแล้ว — เมื่อเพิ่มเมนู ระบบจะผูกตัวเลือกให้เมนูตัวอย่างอัตโนมัติ" };
  return { success: true, message: `ผูกกับสินค้า ${result.linkedProducts} รายการแล้ว — ปรับเพิ่มได้ในแต่ละกลุ่ม` };
}

export async function setGroupProductsAction(_state: ModifierFormState, formData: FormData): Promise<ModifierFormState> {
  void _state;
  const { shopId } = await requireStaff();
  const groupId = field(formData, "groupId");
  const productIds = formData.getAll("productIds").filter((value): value is string => typeof value === "string");
  await setGroupProducts(shopId, groupId, productIds);
  revalidatePath("/admin/modifiers");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateModifierGroupAction(
  _state: ModifierFormState,
  formData: FormData,
): Promise<ModifierFormState> {
  const session = await requireStaff();
  const values = groupValues(formData);
  const parsed = modifierGroupSchema.safeParse({
    ...values,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values };
  }

  try {
    await updateModifierGroup(session.shopId, field(formData, "groupId"), parsed.data);
  } catch {
    return { error: "บันทึกกลุ่มตัวเลือกไม่สำเร็จ กรุณาลองใหม่", values };
  }
  revalidatePath("/admin/modifiers");
  return { success: true };
}

export async function deleteModifierGroupAction(formData: FormData) {
  const { shopId } = await requireStaff();
  await deleteModifierGroup(shopId, field(formData, "groupId"));
  revalidatePath("/admin/modifiers");
  revalidatePath("/admin");
}

export async function createModifierAction(
  _state: ModifierFormState,
  formData: FormData,
): Promise<ModifierFormState> {
  const { shopId } = await requireStaff();
  const values = modifierValues(formData);
  const parsed = modifierSchema.safeParse({
    groupId: field(formData, "groupId"),
    ...values,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", values };
  }

  const { groupId, name, priceDelta } = parsed.data;
  try {
    await createModifier(shopId, groupId, { name, priceDeltaSatang: priceDelta });
  } catch {
    return { error: "เพิ่มตัวเลือกไม่สำเร็จ กรุณาลองใหม่", values };
  }
  revalidatePath("/admin/modifiers");
  return { success: true };
}

export async function deleteModifierAction(formData: FormData) {
  const { shopId } = await requireStaff();
  await deleteModifier(shopId, field(formData, "modifierId"));
  revalidatePath("/admin/modifiers");
}
