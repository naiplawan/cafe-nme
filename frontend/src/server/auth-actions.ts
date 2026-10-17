"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { AUTH_COOKIE_NAME, requestAuthApi } from "@/server/auth-api";
import { createShopInApi, ownerShopExists } from "@/server/shop-setup";

export type AuthActionState = {
  message?: string;
  errors?: Record<string, string[]>;
  email?: string;
  emailNotVerified?: boolean;
  verificationHelp?: boolean;
  values?: Record<string, string>;
};

const signInSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(128),
});

const signUpSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128),
});

const passwordResetRequestSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
});

const emailVerificationTokenSchema = z.object({ token: z.string().min(32) });

const passwordResetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

const shopSchema = z.object({
  shopName: z.string().trim().min(1, "กรุณากรอกชื่อร้าน").max(80, "ชื่อร้านต้องไม่เกิน 80 ตัวอักษร"),
  ownerName: z.string().trim().min(1, "กรุณากรอกชื่อของคุณ").max(80, "ชื่อต้องไม่เกิน 80 ตัวอักษร"),
  promptpayId: z
    .string()
    .trim()
    .transform((value) => value.replace(/[-\s]/g, ""))
    .refine(
      (value) => value === "" || /^(0\d{9}|\d{13})$/.test(value),
      "กรอกเบอร์โทรศัพท์ 10 หลักที่ขึ้นต้นด้วย 0 หรือเลขประจำตัว 13 หลัก",
    ),
  pin: z.string().regex(/^\d{4,6}$/, "PIN ต้องเป็นตัวเลข 4–6 หลัก"),
  confirmPin: z.string(),
}).refine((data) => data.pin === data.confirmPin, {
  message: "PIN ไม่ตรงกัน",
  path: ["confirmPin"],
});

function readFormData(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, formData.get(field) ?? ""]),
  );
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(
    readFormData(formData, ["email", "password"]),
  );
  if (!parsed.success) {
    return {
      email: String(formData.get("email") ?? ""),
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const response = await requestAuthApi("/login", { method: "POST", body: parsed.data });
  if (response.status === 401) return { email: parsed.data.email, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  if (response.status === 403) return { email: parsed.data.email, emailNotVerified: true, message: "กรุณายืนยันที่อยู่อีเมลก่อนเข้าสู่ระบบ" };
  if (response.status === 429) return { email: parsed.data.email, message: "ลองเข้าสู่ระบบใหม่อีกครั้งใน 15 นาที" };
  if (!response.ok) return { email: parsed.data.email, message: "ระบบเข้าสู่ระบบขัดข้อง กรุณาลองอีกครั้ง" };
  const result = await response.json() as { token: string };
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/admin");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordResetRequestSchema.safeParse(readFormData(formData, ["email"]));
  if (!parsed.success) {
    return {
      email: String(formData.get("email") ?? ""),
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const response = await requestAuthApi("/password-reset", { method: "POST", body: parsed.data });
    if (response.status === 429) {
      return { email: parsed.data.email, message: "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
    }
    if (!response.ok) {
      return { email: parsed.data.email, message: "ระบบส่งอีเมลขัดข้อง กรุณาลองอีกครั้ง" };
    }
    return { email: parsed.data.email, message: "หากอีเมลนี้มีบัญชีอยู่ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจสอบกล่องจดหมาย" };
  } catch {
    return { email: parsed.data.email, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function resendEmailVerification(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordResetRequestSchema.safeParse(readFormData(formData, ["email"]));
  if (!parsed.success) {
    return {
      email: String(formData.get("email") ?? ""),
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const response = await requestAuthApi("/email-verification", { method: "POST", body: parsed.data });
    if (response.status === 429) return { email: parsed.data.email, message: "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
    if (!response.ok) return { email: parsed.data.email, message: "ระบบส่งอีเมลขัดข้อง กรุณาลองอีกครั้ง" };
    return { email: parsed.data.email, message: "หากบัญชีนี้ยังไม่ได้ยืนยัน เราจะส่งอีเมลยืนยันให้ กรุณาตรวจสอบกล่องจดหมาย" };
  } catch {
    return { email: parsed.data.email, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function confirmEmailVerification(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailVerificationTokenSchema.safeParse(readFormData(formData, ["token"]));
  if (!parsed.success) return { message: "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว" };

  try {
    const response = await requestAuthApi("/email-verification/confirm", { method: "POST", body: parsed.data });
    if (response.status === 401) return { message: "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่" };
    if (!response.ok) return { message: "ไม่สามารถยืนยันอีเมลได้ กรุณาลองอีกครั้ง" };
    redirect("/login?verified=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordResetSchema.safeParse(readFormData(formData, ["token", "password", "confirmPassword"]));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    const response = await requestAuthApi("/password-reset/confirm", {
      method: "POST",
      body: { token: parsed.data.token, password: parsed.data.password },
    });
    if (response.status === 401) {
      return { message: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" };
    }
    if (!response.ok) {
      return { message: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองอีกครั้ง" };
    }
    redirect("/login?passwordReset=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { message: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(
    readFormData(formData, ["email", "password"]),
  );
  if (!parsed.success) {
    return {
      email: String(formData.get("email") ?? ""),
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const response = await requestAuthApi("/signup", { method: "POST", body: parsed.data });
  if (response.status === 409) return { email: parsed.data.email, message: "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ" };
  if (response.status === 429) return { email: parsed.data.email, message: "สมัครบัญชีมากเกินไป กรุณาลองอีกครั้งใน 1 ชั่วโมง" };
  if (response.status === 503) return { email: parsed.data.email, verificationHelp: true, message: "ยังไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองอีกครั้งหรือขอลิงก์ยืนยันใหม่" };
  if (!response.ok) return { email: parsed.data.email, message: "ไม่สามารถสมัครบัญชีได้ กรุณาลองอีกครั้ง" };
  const result = await response.json() as { token?: string };
  if (result.token) {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/onboarding");
  }
  redirect("/verify-email?sent=1");
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  try {
    await requestAuthApi("/logout", { method: "POST", token });
  } finally {
    cookieStore.delete(AUTH_COOKIE_NAME);
  }
  redirect("/login");
}

export async function createShop(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await getUser();
  if (!user) redirect("/login");

  if (await ownerShopExists(user.id)) redirect("/admin");

  const parsed = shopSchema.safeParse(
    readFormData(formData, ["shopName", "ownerName", "promptpayId", "pin", "confirmPin"]),
  );
  if (!parsed.success) {
    return {
      values: Object.fromEntries(["shopName", "ownerName", "promptpayId"].map((field) => [field, String(formData.get(field) ?? "")])),
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const normalizedSlug = parsed.data.shopName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "shop";
  const slug = `${normalizedSlug}-${randomBytes(3).toString("hex")}`;
  await createShopInApi({
    authUserId: user.id,
    shopName: parsed.data.shopName,
    slug,
    ownerName: parsed.data.ownerName,
    promptpayId: parsed.data.promptpayId || null,
    pin: parsed.data.pin,
  });

  redirect("/admin");
}
