"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isValidPin } from "@/lib/pin";
import { createAdminStaff, listAdminStaff, setAdminStaffActive, setAdminStaffPin } from "@/server/pos-session";

export interface StaffActionState {
  message: string | null;
  success?: boolean;
}
const success = (message: string): StaffActionState => ({ message, success: true });
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
  if (session.staff.role === "manager" && role === "owner") return { message: "ไม่มีสิทธิ์" };
  if (!name || name.length > 80 || !["owner", "manager", "barista"].includes(role) || !isValidPin(pin)) {
    return { message: "กรุณาตรวจสอบชื่อ บทบาท และ PIN (4–6 หลัก)" };
  }
  await createAdminStaff(session.shopId, session.staff.id, { name, role, pin });
  revalidatePath("/admin/staff");
  return success("เพิ่มพนักงานแล้ว");
}

// react-doctor-disable-next-line server-auth-actions -- requireStaff authenticates this direct Server Action call; the inline role check rejects baristas.
export async function setStaffPinAction(staffId: string, _state: StaffActionState, data: FormData): Promise<StaffActionState> {
  const session = await requireStaff();
  if (session.staff.role === "barista") return { message: "ไม่มีสิทธิ์" };
  const pin = text(data, "pin");
  if (!isValidPin(pin)) return { message: "PIN ต้องมี 4–6 หลัก" };
  try {
    const rows = await listAdminStaff(session.shopId, session.staff.id);
    const target = rows.find((row) => row.id === staffId);
    if (!target || (session.staff.role === "manager" && target.role === "owner")) return { message: "ไม่มีสิทธิ์" };
    await setAdminStaffPin(session.shopId, session.staff.id, staffId, pin);
  } catch {
    return { message: "เปลี่ยน PIN ไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePath("/admin/staff");
  return success("เปลี่ยน PIN แล้ว");
}

// react-doctor-disable-next-line server-auth-actions -- requireStaff authenticates this direct Server Action call; the inline role check rejects baristas.
export async function setStaffActiveAction(staffId: string, active: boolean, _state: StaffActionState, _data: FormData): Promise<StaffActionState> {
  void _state;
  void _data;
  const session = await requireStaff();
  if (session.staff.role === "barista") return { message: "ไม่มีสิทธิ์" };
  try {
    const rows = await listAdminStaff(session.shopId, session.staff.id);
    const target = rows.find((row) => row.id === staffId);
    if (!target || (session.staff.role === "manager" && target.role === "owner")) return { message: "ไม่มีสิทธิ์" };
    if (!active && (session.staff.id === staffId || target.role === "owner")) {
      return { message: "ไม่สามารถปิดใช้งานบัญชีของตนเองหรือเจ้าของร้านได้" };
    }
    await setAdminStaffActive(session.shopId, session.staff.id, staffId, active);
  } catch {
    return { message: active ? "เปิดใช้งานบัญชีไม่สำเร็จ กรุณาลองใหม่" : "ปิดใช้งานบัญชีไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  revalidatePath("/admin/staff");
  return success(active ? "เปิดใช้งานบัญชีแล้ว" : "ปิดใช้งานบัญชีแล้ว");
}
