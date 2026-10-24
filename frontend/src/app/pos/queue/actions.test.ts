import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ requirePosStaff: vi.fn(), listPreparation: vi.fn(), transitionPreparation: vi.fn() }));
vi.mock("@/server/pos-session", () => ({ requirePosStaff: boundary.requirePosStaff }));
vi.mock("@/server/preparation", () => ({ listPreparation: boundary.listPreparation, transitionPreparation: boundary.transitionPreparation }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { advancePreparationAction, loadQueueAction } from "./actions";
beforeEach(() => { vi.resetAllMocks(); boundary.requirePosStaff.mockResolvedValue({ shopId: "shop-session", staff: { id: "staff-session" } }); });
it("loads only the authenticated session's shop and staff", async () => {
  boundary.listPreparation.mockResolvedValue([]);
  expect(await loadQueueAction()).toEqual({ ok: true, rows: [] });
  expect(boundary.listPreparation).toHaveBeenCalledWith("shop-session", "staff-session");
});
it("authenticates transitions and passes expected state to the scoped API", async () => {
  const id = "66666666-6666-4666-8666-666666666666";
  const update = { id, status: "preparing", updatedAt: "now" };
  boundary.transitionPreparation.mockResolvedValue(update);
  expect(await advancePreparationAction(id, "received", "preparing")).toEqual({ ok: true, update });
  expect(boundary.transitionPreparation).toHaveBeenCalledWith("shop-session", "staff-session", id, "received", "preparing");
});
it("cannot invoke a mutation without an authenticated session", async () => {
  boundary.requirePosStaff.mockRejectedValue(new Error("unauthenticated"));
  await expect(advancePreparationAction("66666666-6666-4666-8666-666666666666", "received", "preparing")).rejects.toThrow("unauthenticated");
  expect(boundary.transitionPreparation).not.toHaveBeenCalled();
});
