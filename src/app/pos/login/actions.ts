"use server";

import { staffLogin } from "@/server/pos-session";

export type LoginActionState = { message: string | null; success?: boolean };
export async function staffLoginAction(_state: LoginActionState, data: FormData): Promise<LoginActionState> {
  const staffId = data.get("staffId");
  const pin = data.get("pin");
  if (typeof staffId !== "string" || typeof pin !== "string" || !(await staffLogin(staffId, pin))) {
    return { message: "PIN ไม่ถูกต้อง ลองอีกครั้ง" };
  }
  return { message: null, success: true };
}
