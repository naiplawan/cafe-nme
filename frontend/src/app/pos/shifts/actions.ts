"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { requirePosStaff } from "@/server/pos-session";
import { closeShift, openShift, recordCashMovement } from "@/server/shifts";

export type ShiftActionState = { ok: boolean; message: string } | null;
const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/).transform((value) => {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}).pipe(z.number().int().min(0).max(2147483647));
const inputSchema = z.object({ requestId: z.uuid(), amount: amountSchema });

export async function openShiftAction(_previous: ShiftActionState, form: FormData): Promise<ShiftActionState> {
  const session = await requirePosStaff();
  const parsed = inputSchema.safeParse({ requestId: form.get("requestId"), amount: form.get("amount") });
  if (!parsed.success) { return { ok: false, message: "กรอกยอดเงินเป็นบาท ไม่เกินสองตำแหน่งทศนิยม" }; }
  try {
    await openShift(session.shopId, session.staff.id, { requestId: parsed.data.requestId, openingFloatSatang: parsed.data.amount });
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Cash shift opening failed");
    return { ok: false, message: "เปิดกะไม่สำเร็จ กรุณาลองส่งรายการเดิมอีกครั้ง หรือรีเฟรชเพื่อตรวจสอบกะที่เปิดอยู่" };
  }
  revalidatePath("/pos/shifts");
  return { ok: true, message: "เปิดกะแล้ว" };
}

export async function closeShiftAction(_previous: ShiftActionState, form: FormData): Promise<ShiftActionState> {
  const session = await requirePosStaff();
  const parsed = inputSchema.extend({ shiftId: z.uuid(), handedToStaffId: z.uuid().nullable() }).safeParse({
    requestId: form.get("requestId"), amount: form.get("amount"), shiftId: form.get("shiftId"), handedToStaffId: form.get("handedToStaffId") || null,
  });
  if (!parsed.success) { return { ok: false, message: "ตรวจสอบยอดเงินและผู้รับมอบกะ" }; }
  try {
    await closeShift(session.shopId, session.staff.id, parsed.data.shiftId, {
      requestId: parsed.data.requestId, countedCashSatang: parsed.data.amount, handedToStaffId: parsed.data.handedToStaffId,
    });
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, "Cash shift closing failed");
    return { ok: false, message: "ปิดกะไม่สำเร็จ กรุณาลองส่งยอดเดิมอีกครั้ง หรือรีเฟรชเพื่อตรวจสอบสถานะกะ" };
  }
  revalidatePath("/pos/shifts");
  return { ok: true, message: "ปิดกะและบันทึกยอดนับแล้ว" };
}

export async function cashMovementAction(_previous: ShiftActionState, form: FormData): Promise<ShiftActionState> {
  const session = await requirePosStaff();
  if (session.staff.role === 'barista') return { ok: false, message: 'ต้องใช้สิทธิ์ผู้จัดการหรือเจ้าของร้าน' };
  const parsed = inputSchema.extend({ shiftId: z.uuid(), kind: z.enum(['float_topup','petty_cash','bank_deposit']),
    reason: z.string().trim().min(1).max(500) }).safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.amount <= 0) return { ok: false, message: 'ตรวจสอบยอดเงินและระบุเหตุผล' };
  try {
    await recordCashMovement(session.shopId, session.staff.id, parsed.data.shiftId, {
      requestId: parsed.data.requestId, kind: parsed.data.kind, amountSatang: parsed.data.amount, reason: parsed.data.reason,
    });
  } catch (error) {
    logger.error({ err: error, shopId: session.shopId }, 'Cash movement failed');
    return { ok: false, message: 'บันทึกไม่สำเร็จ ตรวจสอบกะและยอดเงินในลิ้นชัก แล้วลองรายการเดิมอีกครั้ง' };
  }
  revalidatePath('/pos/shifts');
  return { ok: true, message: 'บันทึกการรับ–จ่ายเงินแล้ว' };
}
