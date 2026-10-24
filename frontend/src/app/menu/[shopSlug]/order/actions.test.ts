import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ headers: vi.fn(), consumeRateLimit: vi.fn(), submitSelfOrder: vi.fn(), getSelfOrderShop: vi.fn(), getSelfOrderStatus: vi.fn() }));
vi.mock("next/headers", () => ({ headers: api.headers }));
vi.mock("@/server/rate-limit", () => ({ consumeRateLimit: api.consumeRateLimit }));
vi.mock("@/server/self-orders", async (load) => ({ ...await load<typeof import("@/server/self-orders")>(), ...api }));
import { submitSelfOrderAction, selfOrderStatusAction } from "./actions";
const input = { clientKey: "66666666-6666-4666-8666-666666666666", statusToken: "a".repeat(64), mode: "pickup" as const, tableLabel: null, lines: [{ productId: "77777777-7777-4777-8777-777777777777", qty: 1, modifierIds: [] }] };
beforeEach(() => { vi.resetAllMocks(); api.headers.mockResolvedValue(new Headers({ "x-real-ip": "192.0.2.1" })); api.getSelfOrderShop.mockResolvedValue({ shopId: "shop", name: "Cafe" }); api.consumeRateLimit.mockResolvedValue(true); });
it("rate limits anonymous submission by shop and trusted source before writing", async () => {
  api.consumeRateLimit.mockResolvedValue(false);
  const result = await submitSelfOrderAction("cafe", input);
  expect(result.ok).toBe(false);
  expect(api.submitSelfOrder).not.toHaveBeenCalled();
  expect(api.consumeRateLimit).toHaveBeenCalledWith("self-order:shop:192.0.2.1", 10, 600);
});
it("uses the shop resolved from the slug without any staff login", async () => {
  api.submitSelfOrder.mockResolvedValue({ status: "pending" });
  expect(await submitSelfOrderAction("cafe", input)).toEqual({ ok: true, order: { status: "pending" } });
  expect(api.submitSelfOrder).toHaveBeenCalledWith("shop", input);
});
it("requires the private token and limits public status reads", async () => {
  api.getSelfOrderStatus.mockResolvedValue({ status: "accepted" });
  expect(await selfOrderStatusAction("cafe", "a".repeat(64))).toEqual({ ok: true, order: { status: "accepted" } });
  expect(api.getSelfOrderStatus).toHaveBeenCalledWith("shop", "a".repeat(64));
  expect(api.consumeRateLimit).toHaveBeenCalledWith("self-order-status:shop:192.0.2.1", 60, 60);
});

it("treats a definite expired-feature response as an unsubmitted draft", async () => {
  const { SelfOrderApiError } = await import("@/server/self-orders");
  api.submitSelfOrder.mockRejectedValue(new SelfOrderApiError(403));
  const result = await submitSelfOrderAction("cafe", input);
  expect(result).toMatchObject({ ok: false, retryable: false });
});
