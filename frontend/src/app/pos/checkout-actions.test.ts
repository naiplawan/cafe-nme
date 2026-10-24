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

  it("tells the cashier to open a shift when cash checkout is rejected", async () => {
    api.checkout.mockImplementation(async () => { throw new CheckoutError("cash_shift_required" as CheckoutError["code"]); });
    expect(await checkoutAction({ ...input, payment: { method: "cash", cashReceivedSatang: 6500 }, expectedScope: scope }))
      .toEqual({ ok: false, message: "กรุณาเปิดกะและนับเงินทอนก่อนขายเงินสด" });
  });

  it("explains that recipe stock is insufficient without treating the rejected sale as uncertain", async () => {
    api.checkout.mockRejectedValue(new CheckoutError("insufficient_recipe_stock" as CheckoutError["code"]));
    expect(await checkoutAction({ ...input, expectedScope: scope }))
      .toEqual({ ok: false, message: "วัตถุดิบในสูตรไม่พอ กรุณาตรวจยอดสต๊อกก่อนขาย" });
  });

  it("explains ineligible redemption and allows staff to correct the basket", async () => {
    api.checkout.mockRejectedValue(new CheckoutError("reward_ineligible"));
    const response = await checkoutAction({ ...input, expectedScope: scope });
    expect(response).toEqual({ ok: false, message: "ออเดอร์นี้ยังไม่มีเครื่องดื่มที่ใช้รางวัลเป็นส่วนลดได้ กรุณาเพิ่มเครื่องดื่มหรือยกเลิกการใช้รางวัล" });
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

it("delivers a sanitized alert for unexpected checkout failures without losing recovery behavior", async () => {
  const { createServer } = await import("node:http");
  const messages: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) { body += chunk; }
    messages.push(JSON.parse(body));
    response.writeHead(204).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") { throw new Error("missing test port"); }
  vi.stubEnv("OPERATIONAL_ALERT_WEBHOOK_URL", `http://127.0.0.1:${address.port}`);
  auth.session = { shopId: "shop", staff: { id: "staff" }, deviceId: "device" };
  try {
    api.checkout.mockRejectedValue(new CheckoutError("cash_insufficient"));
    await checkoutAction({ ...input, expectedScope: scope });
    expect(messages).toHaveLength(0);
    api.checkout.mockRejectedValue(new Error("secret connection string"));
    expect(await checkoutAction({ ...input, expectedScope: scope })).toMatchObject({ ok: false, retryable: true });
    expect(messages).toEqual([expect.objectContaining({ kind: "checkout_failure", shopIdHash: expect.stringMatching(/^[a-f0-9]{64}$/) })]);
    expect(JSON.stringify(messages)).not.toContain("secret");
  } finally {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
