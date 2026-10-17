import { describe, expect, it } from "vitest";
import {
  checkoutAttempt,
  completePendingCheckout,
  deserializePendingCheckout,
  pendingCheckoutStorageKey,
  resolvePendingCheckout,
  readPendingCheckout,
  savePendingCheckout,
  serializePendingCheckout,
  submitPendingCheckout,
  type PendingCheckoutInput,
} from "./checkout-attempt";

const input = {
  lines: [{ productId: "coffee", qty: 1, modifierIds: [] as string[] }],
  memberId: null,
  redeemRewardId: null,
  payment: { method: "cash" as const, cashReceivedSatang: 10_000 },
};

const expectedScope = { shopId: "shop-1", staffId: "staff-1", deviceId: "device-1" };
const pendingInput = { ...input, requestId: "66666666-6666-4666-8666-666666666666", expectedScope } as unknown as PendingCheckoutInput;

describe("checkout request identity", () => {
  it("reuses the original request ID when retrying the same purchase", () => {
    const first = checkoutAttempt(input, null);
    const retry = checkoutAttempt(structuredClone(input), first);
    expect(retry.requestId).toBe(first.requestId);
  });

  it("starts a new request when quantity, member or tender changes", () => {
    const first = checkoutAttempt(input, null);
    const variants = [
      { ...input, lines: [{ ...input.lines[0], qty: 2 }] },
      { ...input, memberId: "different-member" },
      { ...input, payment: { method: "promptpay" as const } },
      { ...input, payment: { method: "cash" as const, cashReceivedSatang: 20_000 } },
    ];
    for (const next of variants) {
      expect(checkoutAttempt(next, first).requestId).not.toBe(first.requestId);
    }
  });

  it("gives a subsequent identical purchase a fresh ID after completion", () => {
    expect(checkoutAttempt(input, null).requestId).not.toBe(checkoutAttempt(input, null).requestId);
  });

  it("round trips the exact checkout input and request ID without member details", () => {
    const serialized = serializePendingCheckout(pendingInput);
    expect(serialized).toContain(pendingInput.requestId);
    expect(serialized).not.toContain("displayName");
    expect(deserializePendingCheckout(serialized)).toEqual(pendingInput);
  });

  it("uses the existing device and staff cart key as the recovery scope", () => {
    expect(pendingCheckoutStorageKey("cafe-pos-cart:device:staff")).toBe("cafe-pos-cart:device:staff:checkout");
  });

  it("reports storage failure before a checkout can be sent", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("storage disabled"); }, removeItem: () => undefined };
    expect(savePendingCheckout(storage, pendingInput, "cafe-pos-cart:device:staff:checkout")).toBe(false);
    expect(savePendingCheckout(null, pendingInput, "cafe-pos-cart:device:staff:checkout")).toBe(false);
    expect(savePendingCheckout({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, pendingInput, null)).toBe(false);
  });

  it("blocks recovery when the pending checkout cannot be read", () => {
    const storage = { getItem: () => { throw new Error("storage read failed"); }, setItem: () => undefined, removeItem: () => undefined };
    expect(readPendingCheckout(storage, "cafe-pos-cart:device:staff:checkout")).toEqual({ available: false, input: null });

    const malformedStorage = { getItem: () => "not-json", setItem: () => undefined, removeItem: () => undefined };
    expect(readPendingCheckout(malformedStorage, "cafe-pos-cart:device:staff:checkout")).toEqual({ available: false, input: null });
  });

  it("removes the saved cart before the pending checkout and keeps pending on cleanup failure", () => {
    const removed: string[] = [];
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: (key: string) => { removed.push(key); } };
    expect(completePendingCheckout(storage, "cafe-pos-cart:device:staff", "cafe-pos-cart:device:staff:checkout"))
      .toEqual({ cartCleared: true, pendingCleared: true });
    expect(removed).toEqual(["cafe-pos-cart:device:staff", "cafe-pos-cart:device:staff:checkout"]);

    removed.length = 0;
    const failedCartStorage = { getItem: () => null, setItem: () => undefined, removeItem: (key: string) => {
      if (key === "cafe-pos-cart:device:staff") {
        throw new Error("cart clear failed");
      }
      removed.push(key);
    } };
    expect(completePendingCheckout(failedCartStorage, "cafe-pos-cart:device:staff", "cafe-pos-cart:device:staff:checkout"))
      .toEqual({ cartCleared: false, pendingCleared: false });
    expect(removed).toEqual([]);

    const failedPendingStorage = { getItem: () => null, setItem: () => undefined, removeItem: (key: string) => {
      removed.push(key);
      if (key.endsWith(":checkout")) {
        throw new Error("pending clear failed");
      }
    } };
    expect(completePendingCheckout(failedPendingStorage, "cafe-pos-cart:device:staff", "cafe-pos-cart:device:staff:checkout"))
      .toEqual({ cartCleared: true, pendingCleared: false });
    expect(removed).toEqual(["cafe-pos-cart:device:staff", "cafe-pos-cart:device:staff:checkout"]);
  });
});

describe("payment submission recovery", () => {
  const cartKey = "cafe-pos-cart:device:staff";
  const pendingKey = `${cartKey}:checkout`;
  const pointerKey = "cafe-pos-pending-checkout";
  const alternateCartKey = "cafe-pos-cart:other-device:other-staff";
  const receipt = { orderId: "order", dailyNo: 1, subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, changeSatang: 5000, stampsEarned: 0, rewardsCreated: 0, member: null };

  function fixture() {
    const data = new Map<string, string>([[cartKey, "saved cart"]]);
    return { data, storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    } };
  }

  it("persists the exact request before sending and clears both records after confirmation", async () => {
    const { data, storage } = fixture();
    const result = await submitPendingCheckout(pendingInput, storage, cartKey, async (sent) => {
      expect(deserializePendingCheckout(data.get(pendingKey) ?? null)).toEqual(pendingInput);
      expect(sent).toEqual(pendingInput);
      return { ok: true, result: receipt };
    });
    expect(result).toEqual({ kind: "completed", result: receipt });
    expect(data.size).toBe(0);
  });

  it("keeps the original request across an uncertain result and retries it after reload", async () => {
    const { data, storage } = fixture();
    const first = await submitPendingCheckout(pendingInput, storage, cartKey, async () => { throw new Error("response lost"); });
    expect(first.kind).toBe("uncertain");
    const restored = readPendingCheckout(storage, pendingKey).input;
    expect(restored).toEqual(pendingInput);
    const retried = await submitPendingCheckout(restored!, storage, cartKey, async (sent) => {
      expect(sent.requestId).toBe("66666666-6666-4666-8666-666666666666");
      return { ok: true, result: { ...receipt, replayed: true } };
    });
    expect(retried.kind).toBe("completed");
    expect(data.size).toBe(0);
  });

  it("retains a request when the server reports an unknown outcome", async () => {
    const { data, storage } = fixture();
    const result = await submitPendingCheckout(pendingInput, storage, cartKey, async () => ({ ok: false, retryable: true, message: "unknown" }));
    expect(result).toEqual({ kind: "uncertain", message: "unknown" });
    expect(readPendingCheckout(storage, pendingKey).input).toEqual(pendingInput);
    expect(data.get(cartKey)).toBe("saved cart");
  });

  it("preserves the cart and clears only the pending key after a definite rejection", async () => {
    const { data, storage } = fixture();
    const result = await submitPendingCheckout(pendingInput, storage, cartKey, async () => ({ ok: false, message: "sold out" }));
    expect(result).toEqual({ kind: "rejected", message: "sold out" });
    expect(data.has(pendingKey)).toBe(false);
    expect(data.get(cartKey)).toBe("saved cart");
  });

  it("does not send a sale when recovery storage cannot be written", async () => {
    let sent = false;
    const { storage } = fixture();
    const result = await submitPendingCheckout(pendingInput, { ...storage, setItem: () => { throw new Error("blocked"); } }, cartKey, async () => {
      sent = true;
      return { ok: true, result: receipt };
    });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
  });

  it("publishes the unresolved cart pointer before the API and keeps it from another scope", async () => {
    const { data, storage } = fixture();
    const first = await submitPendingCheckout(pendingInput, storage, cartKey, async () => ({ ok: false, retryable: true, message: "unknown" }));
    expect(first).toEqual({ kind: "uncertain", message: "unknown" });
    expect(data.get(pointerKey)).toBe(cartKey);

    let secondSent = false;
    const second = await submitPendingCheckout(pendingInput, storage, alternateCartKey, async () => {
      secondSent = true;
      return { ok: true, result: receipt };
    });
    expect(second.kind).toBe("unavailable");
    expect(secondSent).toBe(false);
    expect(data.get(pointerKey)).toBe(cartKey);
  });

  it("preserves a session scope in the pending request record", () => {
    const scopedInput = { ...pendingInput, expectedScope } as unknown as PendingCheckoutInput;
    expect(deserializePendingCheckout(serializePendingCheckout(scopedInput))).toEqual(scopedInput);
  });

  it("rejects a pending record with an invalid session scope", () => {
    const invalid = { ...pendingInput, expectedScope: { shopId: "", staffId: "staff-1", deviceId: "device-1" } };
    expect(deserializePendingCheckout(JSON.stringify({ version: 1, input: invalid }))).toBeNull();
  });

  it("clears the global pointer only after confirmed cleanup", async () => {
    const { data, storage } = fixture();
    data.set(pointerKey, cartKey);
    const result = await submitPendingCheckout(pendingInput, storage, cartKey, async () => ({ ok: true, result: receipt }));
    expect(result.kind).toBe("completed");
    expect(data.has(pointerKey)).toBe(false);
  });

  it("does not send when the global pointer cannot be persisted", async () => {
    const { storage } = fixture();
    let sent = false;
    const result = await submitPendingCheckout(pendingInput, { ...storage, setItem: (key: string, value: string) => {
      if (key === pointerKey) {
        throw new Error("pointer blocked");
      }
      storage.setItem(key, value);
    } }, cartKey, async () => {
      sent = true;
      return { ok: true, result: receipt };
    });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
  });

  it("does not send an old pending record without a session scope", async () => {
    const { storage } = fixture();
    const legacyInput = { ...input, requestId: pendingInput.requestId } as PendingCheckoutInput;
    let sent = false;
    const result = await submitPendingCheckout(legacyInput, storage, cartKey, async () => {
      sent = true;
      return { ok: true, result: receipt };
    });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
  });

  it("resolves the pointed original cart instead of the current scope", () => {
    const { data, storage } = fixture();
    const originalCartKey = "cafe-pos-cart:original-device:original-staff";
    savePendingCheckout(storage, pendingInput, pendingCheckoutStorageKey(originalCartKey));
    data.set(pointerKey, originalCartKey);

    expect(resolvePendingCheckout(storage, alternateCartKey)).toEqual({
      available: true,
      input: pendingInput,
      cartStorageKey: originalCartKey,
    });
  });

  it("uses the current scope only when no global pointer exists", () => {
    const { storage } = fixture();
    savePendingCheckout(storage, pendingInput, pendingCheckoutStorageKey(alternateCartKey));

    expect(resolvePendingCheckout(storage, alternateCartKey)).toEqual({
      available: true,
      input: pendingInput,
      cartStorageKey: alternateCartKey,
    });
  });

  it("fails closed when a global pointer is invalid or its pending record is missing", () => {
    const { data, storage } = fixture();
    data.set(pointerKey, "");
    expect(resolvePendingCheckout(storage, cartKey)).toEqual({ available: false, input: null, cartStorageKey: null });

    data.set(pointerKey, alternateCartKey);
    expect(resolvePendingCheckout(storage, cartKey)).toEqual({ available: false, input: null, cartStorageKey: null });
  });

  it("retains the pointer when pending cleanup fails", () => {
    const data = new Map<string, string>([[cartKey, "saved cart"], [pointerKey, cartKey], [pendingKey, serializePendingCheckout(pendingInput)]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => {
        if (key === pendingKey) {
          throw new Error("pending clear failed");
        }
        data.delete(key);
      },
    };
    expect(completePendingCheckout(storage, cartKey, pendingKey)).toEqual({ cartCleared: true, pendingCleared: false });
    expect(data.get(pointerKey)).toBe(cartKey);
  });
});
