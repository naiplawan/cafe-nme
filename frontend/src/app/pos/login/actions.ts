"use server";

import { staffLogin } from "@/server/pos-session";
import { getPosDevice } from "@/server/pos-session";
import { consumeRateLimit } from "@/server/rate-limit";

export type LoginActionState = { message: string | null; success?: boolean };
export async function staffLoginAction(_state: LoginActionState, data: FormData): Promise<LoginActionState> {
  const device = await getPosDevice();
  if (!device) return { message: "ไม่พบอุปกรณ์ กรุณาจับคู่ใหม่" };
  if (!(await consumeRateLimit(`pos-login:${device.deviceId}`, 10, 15 * 60))) {
    return { message: "ลองใส่ PIN มากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" };
  }
  const staffId = data.get("staffId");
  const pin = data.get("pin");
  if (typeof staffId !== "string" || typeof pin !== "string" || !(await staffLogin(staffId, pin))) {
    return { message: "PIN ไม่ถูกต้อง ลองอีกครั้ง" };
  }
  return { message: null, success: true };
}
