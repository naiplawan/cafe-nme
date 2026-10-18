"use server";

import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_SHOP_COOKIE_NAME, getUser, requireStaff } from "@/lib/auth";
import { AUTH_COOKIE_NAME, requestAuthApi } from "@/server/auth-api";
import { createShopInApi } from "@/server/shop-setup";
import { findStaffSession, findStaffShops } from "@/server/staff-session";

export type AuthActionState = {
  message?: string;
  errors?: Record<string, string[]>;
  email?: string;
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

  let response: Response;
  try {
    const requestHeaders = await headers();
    const clientAddress = requestHeaders.get("x-real-ip")?.trim()
      || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
    if (!isIP(clientAddress)) {
      return { email: parsed.data.email, message: "ระบบเข้าสู่ระบบขัดข้อง กรุณาลองอีกครั้ง" };
    }
    response = await requestAuthApi("/login", {
      method: "POST",
      body: parsed.data,
      clientAddress,
    });
  } catch {
    return { email: parsed.data.email, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" };
  }
  if (response.status === 401) return { email: parsed.data.email, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
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

  const requestHeaders = await headers();
  const clientAddress = requestHeaders.get("x-real-ip")?.trim()
    || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  if (!isIP(clientAddress)) {
    return { email: parsed.data.email, message: "ระบบสมัครบัญชีขัดข้อง กรุณาลองอีกครั้ง" };
  }
  const response = await requestAuthApi("/signup", { method: "POST", body: parsed.data, clientAddress });
  if (response.status === 409) return { email: parsed.data.email, message: "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ" };
  if (response.status === 429) return { email: parsed.data.email, message: "สมัครบัญชีมากเกินไป กรุณาลองอีกครั้งใน 1 ชั่วโมง" };
  if (!response.ok) return { email: parsed.data.email, message: "ไม่สามารถสมัครบัญชีได้ กรุณาลองอีกครั้ง" };
  return { email: parsed.data.email, message: "ส่งลิงก์ยืนยันไปยังอีเมลแล้ว กรุณายืนยันก่อนเข้าสู่ระบบ" };
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  try {
    await requestAuthApi("/logout", { method: "POST", token });
  } finally {
    cookieStore.delete(AUTH_COOKIE_NAME);
    cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, "", { path: "/admin", maxAge: 0 });
  }
  redirect("/login");
}

export async function selectShop(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const shopId = z.uuid().safeParse(formData.get("shopId"));
  if (!shopId.success) redirect("/select-shop");

  const membership = await findStaffSession(user.id, shopId.data);
  if (!membership) redirect("/select-shop");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, membership.shopId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function createShop(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if ((await findStaffShops(user.id)).length > 0) {
    const currentMembership = await requireStaff();
    if (currentMembership.staff.role !== "owner") redirect("/admin");
  }

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
  const shopId = await createShopInApi({
    authUserId: user.id,
    shopName: parsed.data.shopName,
    slug,
    ownerName: parsed.data.ownerName,
    promptpayId: parsed.data.promptpayId || null,
    pin: parsed.data.pin,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, shopId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/admin");
}
