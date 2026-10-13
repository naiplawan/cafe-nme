"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { hashPin, isValidPin } from "@/lib/pin";

export type StaffActionState = { message: string | null };
const ok: StaffActionState = { message: null };
const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
};

async function allowed() {
  const session = await requireStaff();
  return { ...session, permitted: session.staff.role === "owner" || session.staff.role === "manager" };
}

export async function createStaffAction(_state: StaffActionState, data: FormData): Promise<StaffActionState> {
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  const name = text(data, "name");
  const role = text(data, "role");
  const pin = text(data, "pin");
  if (!name || name.length > 80 || !["owner", "manager", "barista"].includes(role) || !isValidPin(pin)) {
    return { message: "กรุณาตรวจสอบชื่อ บทบาท และ PIN (4–6 หลัก)" };
  }
  await db.insert(staff).values({ shopId: session.shopId, name, role: role as "owner" | "manager" | "barista", pinHash: await hashPin(pin) });
  revalidatePath("/admin/staff");
  return ok;
}

export async function setStaffPinAction(staffId: string, _state: StaffActionState, data: FormData): Promise<StaffActionState> {
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  const pin = text(data, "pin");
  if (!isValidPin(pin)) return { message: "PIN ต้องมี 4–6 หลัก" };
  await db.update(staff).set({ pinHash: await hashPin(pin) })
    .where(and(eq(staff.shopId, session.shopId), eq(staff.id, staffId)));
  revalidatePath("/admin/staff");
  return ok;
}

export async function setStaffActiveAction(staffId: string, active: boolean, _state: StaffActionState, _data: FormData): Promise<StaffActionState> {
  void _state;
  void _data;
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  if (!active) {
    const [target] = await db.select({ role: staff.role }).from(staff)
      .where(and(eq(staff.shopId, session.shopId), eq(staff.id, staffId))).limit(1);
    if (session.staff.id === staffId || target?.role === "owner") {
      return { message: "ไม่สามารถปิดใช้งานบัญชีของตนเองหรือเจ้าของร้านได้" };
    }
  }
  await db.update(staff).set({ isActive: active })
    .where(and(eq(staff.shopId, session.shopId), eq(staff.id, staffId)));
  revalidatePath("/admin/staff");
  return ok;
}
