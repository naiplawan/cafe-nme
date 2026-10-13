"use server";

import { pairDevice } from "@/server/pos-session";

export type PairActionState = { message: string | null; success?: boolean };
export async function pairDeviceAction(_state: PairActionState, data: FormData): Promise<PairActionState> {
  const value = data.get("code");
  const code = typeof value === "string" ? value.trim() : "";
  const paired = await pairDevice(code);
  if (!paired) return { message: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" };
  return { message: null, success: true };
}
