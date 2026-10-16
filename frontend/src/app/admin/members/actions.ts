"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { adjustStamps } from "@/server/loyalty";
import { deleteMemberData } from "@/server/members";

export async function adjustMemberStampsAction(_state: string | null, formData: FormData): Promise<string | null> {
  const { shopId, staff } = await requireStaff();
  if (staff.role !== "owner" && staff.role !== "manager") return "ไม่มีสิทธิ์ปรับแสตมป์";
  const memberId = String(formData.get("memberId") ?? "");
  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") ?? "").trim();
  if (!memberId || !Number.isSafeInteger(delta) || delta === 0) return "กรุณาระบุจำนวนแสตมป์เป็นจำนวนเต็มที่ไม่ใช่ศูนย์";
  if (note.length > 200) return "หมายเหตุต้องไม่เกิน 200 ตัวอักษร";
  try {
    await adjustStamps(shopId, memberId, delta, staff.id, note || undefined);
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/admin/members");
    return "ปรับแสตมป์เรียบร้อย";
  } catch {
    return "ไม่สามารถปรับแสตมป์ได้";
  }
}

export async function deleteMemberAction(_state: string | null, formData: FormData): Promise<string | null> {
  const { shopId, staff } = await requireStaff();
  if (staff.role !== "owner" && staff.role !== "manager") return "ไม่มีสิทธิ์ลบข้อมูลสมาชิก";
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return "ไม่พบข้อมูลสมาชิก";
  try {
    await deleteMemberData(shopId, memberId);
  } catch {
    return "ไม่สามารถลบข้อมูลสมาชิกได้";
  }
  revalidatePath("/admin/members");
  redirect("/admin/members");
}
