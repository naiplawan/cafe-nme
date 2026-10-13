"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { shops, staff } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { hashPin } from "@/lib/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  message?: string;
  errors?: Record<string, string[]>;
  email?: string;
  values?: Record<string, string>;
};

const signInSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

const signUpSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { email: parsed.data.email, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { email: parsed.data.email, message: "ไม่สามารถสมัครบัญชีได้ กรุณาลองอีกครั้ง" };
  if (data.session) redirect("/onboarding");

  return { email: parsed.data.email, message: "ตรวจสอบอีเมลเพื่อยืนยันบัญชี" };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createShop(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const [existingStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.authUserId, user.id))
    .limit(1);
  if (existingStaff) redirect("/admin");

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
  const pinHash = await hashPin(parsed.data.pin);

  await db.transaction(async (tx) => {
    const [shop] = await tx
      .insert(shops)
      .values({
        name: parsed.data.shopName,
        slug,
        promptpayId: parsed.data.promptpayId || null,
      })
      .returning({ id: shops.id });

    await tx.insert(staff).values({
      shopId: shop.id,
      name: parsed.data.ownerName,
      role: "owner",
      authUserId: user.id,
      pinHash,
    });
  });

  redirect("/admin");
}
