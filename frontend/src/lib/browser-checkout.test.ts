// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createCheckoutStorage, submitBrowserCheckout, withCheckoutLock } from "./browser-checkout";
import { resolvePendingCheckout, submitPendingCheckout, type PendingCheckoutInput } from "./checkout-attempt";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const key = "cafe-pos-cart:device:staff";
const input: PendingCheckoutInput = { requestId: "66666666-6666-4666-8666-666666666666", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, lines: [{ productId: "coffee", qty: 1, modifierIds: [] }], payment: { method: "promptpay" } };
const unknown = async () => ({ ok: false as const, retryable: true, message: "unknown" });

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  let queue = Promise.resolve<unknown>(null);
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: (_name: string, _options: unknown, action: () => unknown) => { const next = queue.then(action); queue = next.catch(() => null); return next; } } });
});
describe("durable checkout", () => {
  it("serializes competing tab submissions without overwriting the first uncertain request", async () => {
    let submissions = 0;
    const send = async () => { submissions += 1; return unknown(); };
    const results = await Promise.all([
      submitBrowserCheckout(input, key, send),
      submitBrowserCheckout({ ...input, requestId: "77777777-7777-4777-8777-777777777777" }, key, send),
    ]);
    expect(results.map((result) => result.kind)).toEqual(["uncertain", "unavailable"]);
    expect(submissions).toBe(1);
  });
  it("retries the durable original after reopening without session storage", async () => {
    await submitBrowserCheckout(input, key, unknown);
    sessionStorage.clear();
    const restored = resolvePendingCheckout(createCheckoutStorage(localStorage, sessionStorage), key).input!;
    let sentId = "";
    const result = await submitBrowserCheckout(restored, key, async (sent) => { sentId = sent.requestId; return unknown(); });
    expect(result.kind).toBe("uncertain");
    expect(sentId).toBe("66666666-6666-4666-8666-666666666666");
  });
  it("keeps a wrong-scope retry for restoration of the original session", async () => {
    await submitBrowserCheckout(input, key, unknown);
    const result = await submitBrowserCheckout(input, key, async () => ({ ok: false, retryable: true, message: "original session required" }));
    expect(result.kind).toBe("uncertain");
    expect(resolvePendingCheckout(createCheckoutStorage(localStorage, sessionStorage), "another-shop").input?.expectedScope).toEqual({ shopId: "shop", staffId: "staff", deviceId: "device" });
  });
  it("does not submit when durable storage writes fail", async () => {
    const durable = { ...memory(), setItem: () => { throw new Error("quota"); } };
    let sent = false;
    const result = await submitPendingCheckout(input, createCheckoutStorage(durable, memory()), key, async () => { sent = true; return unknown(); });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
  });
  it("recovers the same scoped request after the original tab storage is gone", async () => {
    const durable = memory();
    await submitPendingCheckout(input, createCheckoutStorage(durable, memory()), key, unknown);
    expect(resolvePendingCheckout(createCheckoutStorage(durable, memory()), key).input).toEqual(input);
  });
  it("does not overwrite an uncertain purchase with a different request", async () => {
    const storage = createCheckoutStorage(memory(), memory());
    await submitPendingCheckout(input, storage, key, unknown);
    let sent = false;
    const result = await submitPendingCheckout({ ...input, requestId: "77777777-7777-4777-8777-777777777777" }, storage, key, async () => { sent = true; return unknown(); });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
    expect(resolvePendingCheckout(storage, key).input?.requestId).toBe(input.requestId);
  });
  it("migrates legacy session pending before the tab can be closed", async () => {
    const legacy = memory();
    await submitPendingCheckout(input, legacy, key, unknown);
    const durable = memory();
    expect(resolvePendingCheckout(createCheckoutStorage(durable, legacy), key).input).toEqual(input);
    expect(resolvePendingCheckout(createCheckoutStorage(durable, memory()), key).input).toEqual(input);
  });
  it("keeps an ordinary cart across a reload before any settlement", () => {
    const storage = createCheckoutStorage(memory(), memory());
    storage.setItem(key, "cart");
    expect(storage.getItem(key)).toBe("cart");
  });
  it("refuses stale in-memory cart writes after another tab settles", () => {
    const durable = memory();
    const first = createCheckoutStorage(durable, memory());
    first.setItem(key, "cart");
    createCheckoutStorage(durable, memory()).removeItem(key);
    expect(() => first.setItem(key, "stale cart")).toThrow();
  });
  it("invalidates an originating tab cart when another tab settles", () => {
    const durable = memory();
    const first = createCheckoutStorage(durable, memory());
    first.setItem(key, "cart");
    createCheckoutStorage(durable, memory()).removeItem(key);
    expect(first.getItem(key)).toBeNull();
  });
  it("fails closed without a cross-tab lock provider", async () => {
    let sent = false;
    const result = await withCheckoutLock(null, async () => { sent = true; return { kind: "uncertain", message: "unknown" }; });
    expect(result.kind).toBe("unavailable");
    expect(sent).toBe(false);
  });
});
