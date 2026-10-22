"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { z } from "zod";
import { requestAuthApi } from "./auth-api";

export type RecoveryState = { success?: boolean; message: string; email?: string };
async function clientAddress() {
  const address = (await headers()).get("x-real-ip")?.trim() || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  if (!isIP(address)) throw new Error("Client address unavailable");
  return address;
}

export async function requestPasswordReset(_previous: RecoveryState, data: FormData): Promise<RecoveryState> {
  const email = String(data.get("email") ?? "").trim();
  if (!z.email().max(254).safeParse(email).success) return { email, message: "กรุณากรอกอีเมลให้ถูกต้อง" };
  try {
    const response = await requestAuthApi("/password-reset/request", { method: "POST", body: { email }, clientAddress: await clientAddress() });
    if (!response.ok) return { email, message: "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่ภายหลัง" };
    return { success: true, email, message: "หากอีเมลนี้มีบัญชี คุณจะได้รับลิงก์ตั้งรหัสผ่านใหม่ โปรดตรวจสอบกล่องจดหมายและสแปม ลิงก์มีอายุ 30 นาที" };
  } catch {
    return { email, message: "เชื่อมต่อไม่ได้ กรุณาลองใหม่" };
  }
}

export async function confirmPasswordReset(_previous: RecoveryState, data: FormData): Promise<RecoveryState> {
  const token = String(data.get("token") ?? "");
  const password = String(data.get("password") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { message: "ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่" };
  if (password.length < 8 || password.length > 128) return { message: "รหัสผ่านต้องมี 8–128 ตัวอักษร" };
  if (password !== data.get("confirmPassword")) return { message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };
  try {
    const response = await requestAuthApi("/password-reset/confirm", { method: "POST", body: { token, password }, clientAddress: await clientAddress() });
    if (response.status === 400) return { message: "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่" };
    if (response.status === 429) return { message: "ลองมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" };
    if (!response.ok) return { message: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" };
    return { success: true, message: "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบอีกครั้ง" };
  } catch {
    return { message: "ยังยืนยันผลไม่ได้ ลองเข้าสู่ระบบด้วยรหัสผ่านใหม่ก่อน หากไม่ได้ให้ขอลิงก์ใหม่" };
  }
}
