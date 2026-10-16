"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { requireStaff } from "@/lib/auth";
import { saveLineConfig, setupRichMenu } from "@/server/line";

export type LineActionState = { message: string | null; success: boolean };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireManager() {
  const session = await requireStaff();
  if (session.staff.role === "barista") throw new Error("ไม่มีสิทธิ์จัดการ LINE");
  return session;
}

export async function saveLineConfigAction(_previous: LineActionState, formData: FormData): Promise<LineActionState> {
  const { shopId } = await requireManager();
  await saveLineConfig(shopId, {
    messagingChannelId: text(formData, "messagingChannelId") || null,
    channelSecret: text(formData, "channelSecret") || undefined,
    accessToken: text(formData, "accessToken") || undefined,
    loginChannelId: text(formData, "loginChannelId") || null,
    liffId: text(formData, "liffId") || null,
  });
  revalidatePath("/admin/line");
  return { message: "บันทึกการตั้งค่าแล้ว", success: true };
}

export async function setupRichMenuAction(_previous: LineActionState, formData: FormData): Promise<LineActionState> {
  void formData;
  const { shopId } = await requireManager();
  try {
    // setupRichMenu reads the LIFF ID itself and wires each button to its own destination.
    await setupRichMenu(shopId);
  } catch (error) {
    logger.error({ err: error, shopId }, "Unable to set up rich menu");
    return { message: "ตั้งค่า Rich Menu ไม่สำเร็จ กรุณาตรวจสอบ LINE access token", success: false };
  }
  revalidatePath("/admin/line");
  return { message: "ตั้งค่า Rich Menu แล้ว", success: true };
}

