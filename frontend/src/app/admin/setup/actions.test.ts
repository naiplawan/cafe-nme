import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ requireStaff: vi.fn(), runTrialCheckout: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireStaff: api.requireStaff }));
vi.mock("@/server/trial-checkout", () => ({ runTrialCheckout: api.runTrialCheckout }));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { trialCheckoutAction } from "./actions";
const lines = [{ productId: "66666666-6666-4666-8666-666666666666", qty: 1, modifierIds: [] }];
beforeEach(() => { vi.resetAllMocks(); });
it("denies a barista without sending a trial request", async () => {
  api.requireStaff.mockResolvedValue({ shopId: "shop", staff: { id: "staff", role: "barista" } });
  const result = await trialCheckoutAction(lines, "cash");
  expect(result).toMatchObject({ ok: false, message: expect.any(String) });
  expect(api.runTrialCheckout).not.toHaveBeenCalled();
});
it("uses authenticated shop and manager, sending no client amount or member", async () => {
  api.requireStaff.mockResolvedValue({ shopId: "shop", staff: { id: "staff", role: "manager" } });
  api.runTrialCheckout.mockResolvedValue({ totalSatang: 5000, itemCount: 1, method: "cash" });
  expect(await trialCheckoutAction(lines, "cash")).toEqual({ ok: true, summary: { totalSatang: 5000, itemCount: 1, method: "cash" } });
  expect(api.runTrialCheckout).toHaveBeenCalledWith("shop", "staff", lines, "cash");
});
