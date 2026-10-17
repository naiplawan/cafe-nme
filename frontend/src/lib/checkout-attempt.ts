import { z } from "zod";
import type { CheckoutInput, CheckoutResult } from "@/server/orders";
import type { CheckoutActionResult } from "@/app/pos/checkout-actions";

export interface CheckoutAttempt {
    requestId: string;
    signature: string 
}
export interface CheckoutSessionScope {
  shopId: string;
  staffId: string;
  deviceId: string;
}
export type PendingCheckoutInput = Omit<CheckoutInput, "requestId"> & { requestId: string; expectedScope?: CheckoutSessionScope };
export type CheckoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface CheckoutCompletion {
    cartCleared: boolean;
    pendingCleared: boolean 
}
export type CheckoutSubmission =
  | { kind: "completed"; result: CheckoutResult }
  | { kind: "rejected" | "uncertain" | "unavailable"; message: string };

export const PENDING_CHECKOUT_POINTER_KEY = "cafe-pos-pending-checkout";

export interface PendingCheckoutResolution {
  available: boolean;
  input: PendingCheckoutInput | null;
  cartStorageKey: string | null;
}

export function checkoutAttempt(input: CheckoutInput, previous: CheckoutAttempt | null): CheckoutAttempt {
  const signature = JSON.stringify({
    lines: input.lines.map(({ productId, qty, modifierIds, note }) => ({ productId, qty, modifierIds, note })),
    memberId: input.memberId ?? null,
    redeemRewardId: input.redeemRewardId ?? null,
    payment: input.payment,
  });
  return previous?.signature === signature ? previous : { requestId: crypto.randomUUID(), signature };
}

const pendingSchema = z.object({
  requestId: z.uuid(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    qty: z.number().int().positive(),
    modifierIds: z.array(z.string()),
    note: z.string().optional(),
  })).min(1),
  memberId: z.string().nullable().optional(),
  redeemRewardId: z.string().nullable().optional(),
  expectedScope: z.object({
    shopId: z.string().min(1),
    staffId: z.string().min(1),
    deviceId: z.string().min(1),
  }).strict().optional(),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("cash"), cashReceivedSatang: z.number().int().nonnegative() }),
    z.object({ method: z.literal("promptpay") }),
  ]),
});
const storedSchema = z.object({ version: z.literal(1), input: pendingSchema });
const pointerSchema = z.string().min(1).refine((value) => value.trim() === value && !value.includes("\u0000"));

export function pendingCheckoutStorageKey(cartStorageKey: string): string {
  return `${cartStorageKey}:checkout`;
}

interface PendingPointer {
  available: boolean;
  cartStorageKey: string | null;
}

function readPendingPointer(storage: CheckoutStorage | null): PendingPointer {
  if (!storage) { return { available: false, cartStorageKey: null }; }
  try {
    const value = storage.getItem(PENDING_CHECKOUT_POINTER_KEY);
    if (value === null) { return { available: true, cartStorageKey: null }; }
    return pointerSchema.safeParse(value).success
      ? { available: true, cartStorageKey: value }
      : { available: false, cartStorageKey: null };
  } catch {
    return { available: false, cartStorageKey: null };
  }
}

function savePendingPointer(storage: CheckoutStorage | null, cartStorageKey: string | null): boolean {
  if (!storage || !cartStorageKey || !pointerSchema.safeParse(cartStorageKey).success) { return false; }
  try {
    storage.setItem(PENDING_CHECKOUT_POINTER_KEY, cartStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function serializePendingCheckout(input: PendingCheckoutInput): string {
  return JSON.stringify({ version: 1, input: pendingSchema.parse(input) });
}

export function deserializePendingCheckout(value: string | null): PendingCheckoutInput | null {
  if (value === null) { return null; }
  try {
    const result = storedSchema.safeParse(JSON.parse(value));
    return result.success ? result.data.input : null;
  } catch {
    return null;
  }
}

export function savePendingCheckout(storage: CheckoutStorage | null, input: PendingCheckoutInput, storageKey: string | null): boolean {
  if (!storage || !storageKey) { return false; }
  try {
    storage.setItem(storageKey, serializePendingCheckout(input));
    return true;
  } catch {
    return false;
  }
}

export function readPendingCheckout(storage: CheckoutStorage | null, storageKey: string | null): { available: boolean; input: PendingCheckoutInput | null } {
  if (!storage || !storageKey) { return { available: false, input: null }; }
  try {
    const value = storage.getItem(storageKey);
    if (value === null) { return { available: true, input: null }; }
    const input = deserializePendingCheckout(value);
    return { available: input !== null, input };
  } catch {
    return { available: false, input: null };
  }
}

export function resolvePendingCheckout(storage: CheckoutStorage | null, currentCartStorageKey: string | null): PendingCheckoutResolution {
  if (!storage || !currentCartStorageKey) {
    return { available: false, input: null, cartStorageKey: null };
  }
  const pointer = readPendingPointer(storage);
  if (!pointer.available) {
    return { available: false, input: null, cartStorageKey: null };
  }
  const cartStorageKey = pointer.cartStorageKey ?? currentCartStorageKey;
  const pending = readPendingCheckout(storage, pendingCheckoutStorageKey(cartStorageKey));
  if (!pending.available || (pointer.cartStorageKey !== null && pending.input === null)) {
    return { available: false, input: null, cartStorageKey: null };
  }
  return { available: true, input: pending.input, cartStorageKey };
}

export function clearPendingCheckout(storage: CheckoutStorage | null, storageKey: string | null): boolean {
  if (!storage || !storageKey) { return false; }
  try {
    storage.removeItem(storageKey);
  } catch {
    return false;
  }
  try {
    const cartStorageKey = storageKey.endsWith(":checkout") ? storageKey.slice(0, -":checkout".length) : storageKey;
    const pointer = storage.getItem(PENDING_CHECKOUT_POINTER_KEY);
    if (pointer === storageKey || pointer === cartStorageKey) {
      storage.removeItem(PENDING_CHECKOUT_POINTER_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function completePendingCheckout(storage: CheckoutStorage | null, cartStorageKey: string | null, pendingStorageKey: string | null): CheckoutCompletion {
  if (!storage || !cartStorageKey || !pendingStorageKey) { return { cartCleared: false, pendingCleared: false }; }
  try {
    storage.removeItem(cartStorageKey);
  } catch {
    return { cartCleared: false, pendingCleared: false };
  }
  return { cartCleared: true, pendingCleared: clearPendingCheckout(storage, pendingStorageKey) };
}

export async function submitPendingCheckout(
  input: PendingCheckoutInput, storage: CheckoutStorage | null, cartStorageKey: string | null,
  submit: (input: PendingCheckoutInput) => Promise<CheckoutActionResult>,
): Promise<CheckoutSubmission> {
  if (!input.expectedScope) {
    return { kind: "unavailable", message: "ไม่สามารถยืนยันรายการเดิมได้ กรุณาเข้าสู่ระบบพนักงานเดิม" };
  }
  const pointer = readPendingPointer(storage);
  if (!pointer.available || (pointer.cartStorageKey !== null && pointer.cartStorageKey !== cartStorageKey)) {
    return { kind: "unavailable", message: "มีรายการชำระเงินที่กำลังรอตรวจสอบอยู่บนอุปกรณ์อื่น" };
  }
  const key = cartStorageKey ? pendingCheckoutStorageKey(cartStorageKey) : null;
  if (!savePendingCheckout(storage, input, key)) {
    return { kind: "unavailable", message: "ไม่สามารถเตรียมรายการกู้คืนได้ กรุณาลองใหม่" };
  }
  if (pointer.cartStorageKey === null && !savePendingPointer(storage, cartStorageKey)) {
    return { kind: "unavailable", message: "ไม่สามารถเตรียมรายการกู้คืนได้ กรุณาลองใหม่" };
  }
  try {
    const response = await submit(input);
    if (response.ok) {
      completePendingCheckout(storage, cartStorageKey, key);
      return { kind: "completed", result: response.result };
    }
    if (response.retryable) { return { kind: "uncertain", message: response.message }; }
    if (!clearPendingCheckout(storage, key)) {
      return { kind: "uncertain", message: "ไม่สามารถล้างรายการกู้คืนได้ กรุณาลองใหม่" };
    }
    return { kind: "rejected", message: response.message };
  } catch {
    return { kind: "uncertain", message: "ยังไม่ทราบผลการบันทึก กรุณาตรวจสอบรายการเดิมอีกครั้งก่อนรับออเดอร์ใหม่" };
  }
}
