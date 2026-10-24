import { PENDING_CHECKOUT_POINTER_KEY, pendingCheckoutStorageKey, resolvePendingCheckout, submitPendingCheckout, type CheckoutStorage, type CheckoutSubmission, type PendingCheckoutInput } from "./checkout-attempt";
import type { CheckoutActionResult } from "@/app/pos/checkout-actions";

const unavailable: CheckoutSubmission = { kind: "unavailable", message: "ไม่สามารถตรวจสอบรายการเดิมได้ กรุณาโหลดหน้าใหม่ก่อนรับชำระ" };
const isCart = (key: string) => key.startsWith("cafe-pos-cart:") && !key.endsWith(":checkout");
const generationKey = (key: string) => `${key}:settled`;

// Pending records are durable; carts remain private to their original tab.
export function createCheckoutStorage(durable: CheckoutStorage, session: CheckoutStorage): CheckoutStorage {
  return {
    getItem(key) {
      if (isCart(key)) {
        const generation = generationKey(key);
        if ((session.getItem(generation) ?? "") !== (durable.getItem(generation) ?? "")) {
          session.removeItem(key);
          session.setItem(generation, durable.getItem(generation) ?? "");
          return null;
        }
        return session.getItem(key);
      }
      const existing = durable.getItem(key);
      const legacy = session.getItem(key);
      if (legacy !== null) {
        if (existing !== null && existing !== legacy) { throw new Error("Conflicting pending checkouts"); }
        if (key === PENDING_CHECKOUT_POINTER_KEY) {
          const pendingKey = pendingCheckoutStorageKey(legacy);
          const pending = session.getItem(pendingKey);
          if (!pending) { throw new Error("Missing legacy checkout"); }
          const saved = durable.getItem(pendingKey);
          if (saved !== null && saved !== pending) { throw new Error("Conflicting pending checkouts"); }
          durable.setItem(pendingKey, pending);
        }
        durable.setItem(key, legacy);
        session.removeItem(key);
        if (key === PENDING_CHECKOUT_POINTER_KEY) { session.removeItem(pendingCheckoutStorageKey(legacy)); }
        return legacy;
      }
      return existing;
    },
    setItem(key, value) {
      if (isCart(key)) {
        if ((session.getItem(generationKey(key)) ?? "") !== (durable.getItem(generationKey(key)) ?? "")) { throw new Error("Cart settled in another tab"); }
        session.setItem(generationKey(key), durable.getItem(generationKey(key)) ?? "");
        session.setItem(key, value);
      } else { durable.setItem(key, value); }
    },
    removeItem(key) {
      if (isCart(key)) {
        durable.setItem(generationKey(key), crypto.randomUUID());
        session.removeItem(key);
        session.setItem(generationKey(key), durable.getItem(generationKey(key)) ?? "");
      } else {
        durable.removeItem(key);
        session.removeItem(key);
      }
    },
  };
}

export function getCheckoutStorage(): CheckoutStorage | null {
  try { return createCheckoutStorage(window.localStorage, window.sessionStorage); } catch { return null; }
}

export async function withCheckoutLock(locks: Pick<LockManager, "request"> | null, action: () => Promise<CheckoutSubmission>): Promise<CheckoutSubmission> {
  if (!locks) { return unavailable; }
  try { return await locks.request("cafe-pos-checkout", { mode: "exclusive" }, action); } catch { return unavailable; }
}

export async function resolveBrowserCheckout(cartKey: string) {
  if (!navigator.locks) { return { available: false, input: null, cartStorageKey: null }; }
  try {
    return await navigator.locks.request("cafe-pos-checkout", { mode: "exclusive" }, () => resolvePendingCheckout(getCheckoutStorage(), cartKey));
  } catch { return { available: false, input: null, cartStorageKey: null }; }
}

export async function submitBrowserCheckout(input: PendingCheckoutInput, cartKey: string | null, submit: (input: PendingCheckoutInput) => Promise<CheckoutActionResult>): Promise<CheckoutSubmission> {
  return withCheckoutLock(navigator.locks ?? null, async () => {
    if (!cartKey) { return unavailable; }
    const storage = getCheckoutStorage();
    // A payment completed in another tab invalidates this tab's in-memory cart too.
    const generation = generationKey(cartKey);
    const pending = resolvePendingCheckout(storage, cartKey);
    if (!pending.available) { return unavailable; }
    if (!pending.input && window.sessionStorage.getItem(generation) !== window.localStorage.getItem(generation)
      && window.localStorage.getItem(generation) !== null) { return unavailable; }
    return submitPendingCheckout(input, storage, cartKey, submit);
  });
}
