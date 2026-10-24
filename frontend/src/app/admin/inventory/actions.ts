"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createIngredient, InventoryApiError, moveInventory, saveRecipe, setInventoryThreshold } from "@/server/inventory";

export type InventoryActionState = { success: boolean; message: string } | null;
const amount = z.string().regex(/^-?\d+(\.\d{1,3})?$/).transform((value) => {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return (Number(whole) * 1000 + Number(fraction.padEnd(3, "0"))) * (negative ? -1 : 1);
}).pipe(z.number().int().min(-2147483647).max(2147483647));
const invalid = { success: false, message: "ตรวจสอบข้อมูลและจำนวน (ไม่เกินสามตำแหน่งทศนิยม)" };
const forbidden = { success: false, message: "ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการ" };

export async function createIngredientAction(_previous: InventoryActionState, form: FormData): Promise<InventoryActionState> {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") { return forbidden; }
  const parsed = z.object({ name: z.string().trim().min(1).max(100), unit: z.enum(["g", "ml", "unit"]), lowStockMilliunits: amount.pipe(z.number().nonnegative()) })
    .safeParse({ name: form.get("name"), unit: form.get("unit"), lowStockMilliunits: form.get("threshold") });
  if (!parsed.success) { return invalid; }
  try { await createIngredient(session.shopId, session.staff.id, parsed.data); }
  catch (error) { logger.error({ err: error, shopId: session.shopId }, "Ingredient creation failed"); return { success: false, message: "เพิ่มวัตถุดิบไม่สำเร็จ ตรวจสอบชื่อซ้ำแล้วลองใหม่" }; }
  revalidatePath("/admin/inventory");
  return { success: true, message: "เพิ่มวัตถุดิบแล้ว" };
}

export async function setThresholdAction(_previous: InventoryActionState, form: FormData): Promise<InventoryActionState> {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") { return forbidden; }
  const parsed = z.object({ ingredientId: z.uuid(), value: amount.pipe(z.number().nonnegative()) }).safeParse({ ingredientId: form.get("ingredientId"), value: form.get("threshold") });
  if (!parsed.success) { return invalid; }
  try { await setInventoryThreshold(session.shopId, session.staff.id, parsed.data.ingredientId, parsed.data.value); }
  catch (error) { logger.error({ err: error, shopId: session.shopId }, "Stock threshold update failed"); return { success: false, message: "บันทึกจุดเตือนไม่สำเร็จ" }; }
  revalidatePath("/admin/inventory");
  return { success: true, message: "บันทึกจุดเตือนแล้ว" };
}

export async function moveInventoryAction(_previous: InventoryActionState, form: FormData): Promise<InventoryActionState> {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") { return forbidden; }
  const parsed = z.object({ ingredientId: z.uuid(), requestId: z.uuid(), kind: z.enum(["receive", "waste", "adjust"]), quantityMilliunits: amount,
    reason: z.string().trim().min(1).max(500) }).safeParse({ ingredientId: form.get("ingredientId"), requestId: form.get("requestId"),
    kind: form.get("kind"), quantityMilliunits: form.get("quantity"), reason: form.get("reason") });
  if (!parsed.success || parsed.data.quantityMilliunits === 0 || (parsed.data.kind !== "adjust" && parsed.data.quantityMilliunits < 0)) { return invalid; }
  const { ingredientId, ...input } = parsed.data;
  try { await moveInventory(session.shopId, session.staff.id, ingredientId, input); }
  catch (error) {
    if (error instanceof InventoryApiError && error.code === "insufficient_inventory_stock") {
      return { success: false, message: "จำนวนที่ตัดมากกว่ายอดคงเหลือ ตรวจยอดแล้วแก้จำนวนก่อนบันทึก" };
    }
    logger.error({ err: error, shopId: session.shopId }, "Stock movement failed");
    return { success: false, message: "ยังไม่ทราบผล กรุณาลองส่งรายการเดิมด้วยจำนวนและเหตุผลเดิมอีกครั้ง" };
  }
  revalidatePath("/admin/inventory");
  return { success: true, message: "บันทึกการเคลื่อนไหวแล้ว" };
}

export async function saveRecipeAction(_previous: InventoryActionState, form: FormData): Promise<InventoryActionState> {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") { return forbidden; }
  const target = z.object({ kind: z.enum(["product", "modifier"]), id: z.uuid() }).safeParse({ kind: form.get("kind"), id: form.get("targetId") });
  if (!target.success) { return invalid; }
  const lines: { ingredientId: string; quantityMilliunits: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("quantity:") || value === "") { continue; }
    const parsed = z.object({ ingredientId: z.uuid(), quantityMilliunits: amount.pipe(z.number().nonnegative()) })
      .safeParse({ ingredientId: key.slice(9), quantityMilliunits: value });
    if (!parsed.success) { return invalid; }
    if (parsed.data.quantityMilliunits > 0) { lines.push(parsed.data); }
  }
  if (lines.length > 100) { return invalid; }
  try { await saveRecipe(session.shopId, session.staff.id, target.data.kind, target.data.id, lines); }
  catch (error) { logger.error({ err: error, shopId: session.shopId }, "Recipe update failed"); return { success: false, message: "บันทึกสูตรไม่สำเร็จ กรุณาตรวจสอบวัตถุดิบแล้วลองใหม่" }; }
  revalidatePath("/admin/inventory");
  return { success: true, message: "บันทึกสูตรสำหรับการขายครั้งถัดไปแล้ว" };
}
