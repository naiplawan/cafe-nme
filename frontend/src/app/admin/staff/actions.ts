"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isValidPin } from "@/lib/pin";
import { createAdminStaff, listAdminStaff, setAdminStaffActive, setAdminStaffPin } from "@/server/pos-session";

export type StaffActionState = { message: string | null };
const ok: StaffActionState = { message: null };
const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// react-doctor-disable-next-line server-auth-actions -- requireStaff authenticates this direct Server Action call; the inline role check rejects baristas.
export async function createStaffAction(_state: StaffActionState, data: FormData): Promise<StaffActionState> {
  const session = await requireStaff();
  if (session.staff.role === "barista") return { message: "ไม่มีสิทธิ์" };
  const name = text(data, "name");
  const role = text(data, "role");
  const pin = text(data, "pin");
  if (!name || name.length > 80 || !["owner", "manager", "barista"].includes(role) || !isValidPin(pin)) {
    return { message: "กรุณาตรวจสอบชื่อ บทบาท และ PIN (4–6 หลัก)" };
  }
  await createAdminStaff(session.shopId, session.staff.id, { name, role, pin });
  revalidatePath("/admin/staff");
  return ok;
}

// react-doctor-disable-next-line server-auth-actions -- requireStaff authenticates this direct Server Action call; the inline role check rejects baristas.
export async function setStaffPinAction(staffId: string, _state: StaffActionState, data: FormData): Promise<StaffActionState> {
  const session = await requireStaff();
  if (session.staff.role === "barista") return { message: "ไม่มีสิทธิ์" };
  const pin = text(data, "pin");
  if (!isValidPin(pin)) return { message: "PIN ต้องมี 4–6 หลัก" };
  await setAdminStaffPin(session.shopId, session.staff.id, staffId, pin);
  revalidatePath("/admin/staff");
  return ok;
}

// react-doctor-disable-next-line server-auth-actions -- requireStaff authenticates this direct Server Action call; the inline role check rejects baristas.
export async function setStaffActiveAction(staffId: string, active: boolean, _state: StaffActionState, _data: FormData): Promise<StaffActionState> {
  void _state;
  void _data;
  const session = await requireStaff();
  if (session.staff.role === "barista") return { message: "ไม่มีสิทธิ์" };
  if (!active) {
    const rows = await listAdminStaff(session.shopId, session.staff.id);
    const target = rows.find((row) => row.id === staffId);
    if (session.staff.id === staffId || target?.role === "owner") {
      return { message: "ไม่สามารถปิดใช้งานบัญชีของตนเองหรือเจ้าของร้านได้" };
    }
  }
  await setAdminStaffActive(session.shopId, session.staff.id, staffId, active);
  revalidatePath("/admin/staff");
  return ok;
}
