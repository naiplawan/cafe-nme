"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CartLineInput } from "@/lib/pricing";
import { requireStaff } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { runTrialCheckout } from "@/server/trial-checkout";
const linesSchema = z.array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(99), modifierIds: z.array(z.uuid()).max(30), note: z.string().max(120).optional() }).strict()).min(1).max(100);
export async function trialCheckoutAction(lines: CartLineInput[], method: "cash" | "promptpay") {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") { return { ok: false as const, message: "เฉพาะเจ้าของร้านหรือผู้จัดการที่ทดลองออกบิลได้" }; }
  const parsed = linesSchema.safeParse(lines);
  if (!parsed.success || !["cash", "promptpay"].includes(method)) { return { ok: false as const, message: "กรุณาตรวจสอบรายการและตัวเลือก" }; }
  try {
    const summary = await runTrialCheckout(session.shopId, session.staff.id, parsed.data, method);
    revalidatePath("/admin");
    revalidatePath("/admin/setup");
    return { ok: true as const, summary };
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Setup trial checkout failed");
    return { ok: false as const, message: "ทดลองไม่สำเร็จ กรุณาตรวจสอบเมนู ตัวเลือก และการตั้งค่าพร้อมเพย์ แล้วลองใหม่" };
  }
}
