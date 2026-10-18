"use server";

import { headers } from "next/headers";
import { pairDevice } from "@/server/pos-session";
import { consumeRateLimit } from "@/server/rate-limit";
import { isIP } from "node:net";

export type PairActionState = { message: string | null; success?: boolean };
export async function pairDeviceAction(_state: PairActionState, data: FormData): Promise<PairActionState> {
  const requestHeaders = await headers();
  const headerAddress = requestHeaders.get("x-real-ip")?.trim()
    || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  if (!isIP(headerAddress)) return { message: "ไม่สามารถตรวจสอบการเชื่อมต่อได้ กรุณาลองใหม่" };
  const clientAddress = headerAddress;
  if (!(await consumeRateLimit(`pos-pair:${clientAddress}`, 20, 10 * 60))) {
    return { message: "ลองจับคู่อุปกรณ์มากเกินไป กรุณารอ 10 นาทีแล้วลองใหม่" };
  }
  const value = data.get("code");
  const code = typeof value === "string" ? value.trim() : "";
  const paired = await pairDevice(code);
  if (!paired) return { message: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" };
  return { message: null, success: true };
}
