import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ requirePosStaff: vi.fn(), listSelfOrders: vi.fn(), decideSelfOrder: vi.fn() }));
vi.mock("@/server/pos-session", () => ({ requirePosStaff: api.requirePosStaff }));
vi.mock("@/server/self-orders", () => api);
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { decideRequestAction, loadRequestsAction } from "./actions";
beforeEach(() => { vi.resetAllMocks(); api.requirePosStaff.mockResolvedValue({ shopId: "shop", staff: { id: "staff" } }); });
it("scopes reads and decisions to authenticated staff", async () => {
  api.listSelfOrders.mockResolvedValue([]); api.decideSelfOrder.mockResolvedValue({ status: "accepted" });
  expect(await loadRequestsAction()).toEqual({ ok: true, orders: [] });
  expect(await decideRequestAction("66666666-6666-4666-8666-666666666666", "accepted")).toEqual({ ok: true, order: { status: "accepted" } });
  expect(api.listSelfOrders).toHaveBeenCalledWith("shop", "staff");
  expect(api.decideSelfOrder).toHaveBeenCalledWith("shop", "staff", "66666666-6666-4666-8666-666666666666", "accepted");
});
it("requires authentication even when a draft ID is known", async () => {
  api.requirePosStaff.mockRejectedValue(new Error("login"));
  await expect(decideRequestAction("66666666-6666-4666-8666-666666666666", "accepted")).rejects.toThrow("login");
  expect(api.decideSelfOrder).not.toHaveBeenCalled();
});
