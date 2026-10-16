"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { removeLogo, saveAccent, saveLogo } from "@/server/brand";
import { setupRichMenu } from "@/server/line";

export type BrandActionState = { message: string | null; success: boolean };

async function manager() {
  const session = await requireStaff();
  if (session.staff.role === "barista") return null;
  return session;
}

export async function saveAccentAction(_previous: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const session = await manager();
  if (!session) return { message: "ไม่มีสิทธิ์", success: false };
  const value = formData.get("accent");
  const accent = typeof value === "string" ? value.trim() : "";
  try {
    await saveAccent(session.shopId, accent || null);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "บันทึกสีไม่สำเร็จ", success: false };
  }
  revalidatePath("/admin/brand");
  return { message: "บันทึกสีแล้ว", success: true };
}

export async function uploadLogoAction(_previous: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const session = await manager();
  if (!session) return { message: "ไม่มีสิทธิ์", success: false };
  const logo = formData.get("logo");
  if (!(logo instanceof File)) return { message: "กรุณาเลือกไฟล์โลโก้", success: false };
  try {
    await saveLogo(session.shopId, new Uint8Array(await logo.arrayBuffer()));
  } catch (error) {
    return { message: error instanceof Error ? error.message : "บันทึกโลโก้ไม่สำเร็จ", success: false };
  }
  revalidatePath("/admin/brand");
  return { message: "บันทึกโลโก้แล้ว", success: true };
}

export async function removeLogoAction(_previous: BrandActionState): Promise<BrandActionState> {
  void _previous;
  const session = await manager();
  if (!session) return { message: "ไม่มีสิทธิ์", success: false };
  await removeLogo(session.shopId);
  revalidatePath("/admin/brand");
  return { message: "ลบโลโก้แล้ว", success: true };
}

export async function pushRichMenuAction(_previous: BrandActionState): Promise<BrandActionState> {
  void _previous;
  const session = await manager();
  if (!session) return { message: "ไม่มีสิทธิ์", success: false };
  try {
    await setupRichMenu(session.shopId);
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Unable to set up rich menu");
    return { message: "ตั้งค่า Rich Menu ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า LINE", success: false };
  }
  revalidatePath("/admin/brand");
  return { message: "อัปเดต Rich Menu ใน LINE แล้ว", success: true };
}
