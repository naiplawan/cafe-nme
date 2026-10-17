import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutError } from "@/server/orders";
import { checkoutAction } from "./checkout-actions";
import { submitPendingCheckout } from "@/lib/checkout-attempt";

const api = vi.hoisted(() => ({ checkout: vi.fn() }));
const auth = vi.hoisted(() => ({
  session: { shopId: "shop", staff: { id: "staff" }, deviceId: "device" },
}));
vi.mock("@/server/orders", async (original) => ({ ...await original<typeof import("@/server/orders")>(), checkout: api.checkout }));
vi.mock("@/server/pos-session", () => ({ requirePosStaff: async () => auth.session }));
vi.mock("@/server/pos-operations", () => ({ getPosPromptPayConfig: async () => null }));
vi.mock("@/lib/logger", () => ({ logger: { error: () => undefined } }));

const input = { lines: [{ productId: "coffee", qty: 1, modifierIds: [] }], payment: { method: "promptpay" as const } };
const scope = { shopId: "shop", staffId: "staff", deviceId: "device" };
const result = { orderId: "order", dailyNo: 1, subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, changeSatang: 0, stampsEarned: 0, rewardsCreated: 0, member: null };

describe("checkout action recovery", () => {
  it("forwards the persisted original scope through the submission executor to the authenticated action", async () => {
    api.checkout.mockResolvedValue(result);
    const records = new Map<string, string>();
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => { records.set(key, value); },
      removeItem: (key: string) => { records.delete(key); },
    };
    const outcome = await submitPendingCheckout({
      ...input, requestId: "66666666-6666-4666-8666-666666666666", expectedScope: scope,
    }, storage, "cafe-pos-cart:device:staff", checkoutAction);
    expect(outcome).toEqual({ kind: "completed", result });
    expect(records.size).toBe(0);
  });

  beforeEach(() => {
    api.checkout.mockReset();
    auth.session = { shopId: "shop", staff: { id: "staff" }, deviceId: "device" };
  });

  it("allows Nest to return an already committed checkout after receiving settings are disabled", async () => {
    api.checkout.mockResolvedValue(result);
    expect(await checkoutAction({ ...input, expectedScope: scope })).toEqual({ ok: true, result });
    expect(api.checkout).toHaveBeenCalledWith({ shopId: "shop", staffId: "staff" }, input);
  });

  it("marks an unknown API failure as needing a retry of the original request", async () => {
    api.checkout.mockImplementation(async () => { throw new Error("connection lost"); });
    expect(await checkoutAction({ ...input, payment: { method: "cash", cashReceivedSatang: 10_000 }, expectedScope: scope })).toMatchObject({ ok: false, retryable: true });
  });

  it("allows corrections after a definite rejected checkout", async () => {
    api.checkout.mockImplementation(async () => { throw new CheckoutError("cash_insufficient"); });
    const response = await checkoutAction({ ...input, payment: { method: "cash", cashReceivedSatang: 1 }, expectedScope: scope });
    expect(response).toMatchObject({ ok: false });
    expect("retryable" in response && response.retryable).not.toBe(true);
  });

  it("requires the original staff and device scope before calling checkout", async () => {
    auth.session = { shopId: "shop-b", staff: { id: "staff-b" }, deviceId: "device-b" };
    api.checkout.mockResolvedValue(result);

    const response = await checkoutAction({ ...input, expectedScope: scope });

    expect(response).toMatchObject({ ok: false, retryable: true });
    if (!response.ok) {
      expect(response.message).toContain("พนักงานและอุปกรณ์เดิม");
    }
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it.each([
    { shopId: "other-shop", staffId: "staff", deviceId: "device" },
    { shopId: "shop", staffId: "other-staff", deviceId: "device" },
    { shopId: "shop", staffId: "staff", deviceId: "other-device" },
  ])("keeps a mismatch of each original scope field unresolved: %j", async (expectedScope) => {
    api.checkout.mockResolvedValue(result);
    expect(await checkoutAction({ ...input, expectedScope })).toMatchObject({ ok: false, retryable: true });
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it("fails safe when the checkout has no original session scope", async () => {
    api.checkout.mockResolvedValue(result);

    const response = await checkoutAction(input);

    expect(response).toMatchObject({ ok: false, retryable: true });
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it("keeps an idempotency conflict retryable so the original result can be recovered", async () => {
    api.checkout.mockImplementation(async () => { throw new CheckoutError("idempotency_key_reused"); });

    const response = await checkoutAction({ ...input, expectedScope: scope });

    expect(response).toMatchObject({ ok: false, retryable: true });
  });
});
