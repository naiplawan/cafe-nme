import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getSubscription: vi.fn(), recordManualRenewal: vi.fn(), session: vi.fn() }));
vi.mock("@/server/subscriptions", () => api);
vi.mock("@/lib/auth", () => ({ requireStaff: api.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
const requestId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ shopId: "shop", userId: "operator-user", staff: { id: "operator-staff", role: "manager" } });
  api.getSubscription.mockResolvedValue({ canRecordPayment: true });
});
function form() {
  const input = new FormData(); input.set("requestId", requestId); input.set("plan", "pro"); input.set("amount", "123.45");
  input.set("periodDays", "30"); input.set("externalReceiptRef", "MANUAL-001"); input.set("actorUserId", "forged-user");
  return input;
}
it("uses authenticated operator identity and exact manually entered amount", async () => {
  const { recordManualRenewalAction } = await import("./actions");
  expect(await recordManualRenewalAction(null, form())).toMatchObject({ success: true });
  expect(api.recordManualRenewal).toHaveBeenCalledWith("shop", "operator-staff", "operator-user", {
    requestId, plan: "pro", paidAmountSatang: 12345, periodDays: 30, externalReceiptRef: "MANUAL-001",
  });
});
it("does not let a store owner grant their own paid subscription", async () => {
  const { recordManualRenewalAction } = await import("./actions");
  api.session.mockResolvedValue({ shopId: "shop", userId: "owner-user", staff: { id: "owner-staff", role: "owner" } });
  api.getSubscription.mockResolvedValue({ canRecordPayment: false });
  expect(await recordManualRenewalAction(null, form())).toMatchObject({ success: false });
  expect(api.recordManualRenewal).not.toHaveBeenCalled();
});
it("rejects sub-satang precision and preserves the request key for a transport retry", async () => {
  const { recordManualRenewalAction } = await import("./actions");
  const input = form(); input.set("amount", "1.001");
  expect(await recordManualRenewalAction(null, input)).toMatchObject({ success: false });
  expect(api.recordManualRenewal).not.toHaveBeenCalled();
  input.set("amount", "123.45");
  api.recordManualRenewal.mockRejectedValueOnce(new Error("lost response"));
  expect(await recordManualRenewalAction(null, input)).toMatchObject({ success: false });
  api.recordManualRenewal.mockResolvedValue({ id: "payment" });
  expect(await recordManualRenewalAction(null, input)).toMatchObject({ success: true });
  expect(api.recordManualRenewal.mock.calls[0]).toEqual(api.recordManualRenewal.mock.calls[1]);
});
