import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ openShift: vi.fn(), closeShift: vi.fn(), session: vi.fn() }));
vi.mock("@/server/shifts", () => ({ openShift: api.openShift, closeShift: api.closeShift }));
vi.mock("@/server/pos-session", () => ({ requirePosStaff: api.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ shopId: "11111111-1111-4111-8111-111111111111", staff: { id: "22222222-2222-4222-8222-222222222222" } });
});
it("binds drawer changes to authenticated shop/staff and parses satang without rounding", async () => {
  const { openShiftAction } = await import("./actions");
  const form = new FormData();
  form.set("requestId", "33333333-3333-4333-8333-333333333333");
  form.set("amount", "100.25");
  form.set("shopId", "foreign");
  form.set("actorStaffId", "foreign");
  expect(await openShiftAction(null, form)).toMatchObject({ ok: true });
  expect(api.openShift).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", { requestId: "33333333-3333-4333-8333-333333333333", openingFloatSatang: 10025 });
});
it("rejects fractional satang before mutation and preserves a retryable close request key", async () => {
  const { closeShiftAction } = await import("./actions");
  const form = new FormData();
  form.set("requestId", "33333333-3333-4333-8333-333333333333");
  form.set("shiftId", "44444444-4444-4444-8444-444444444444");
  form.set("amount", "10.005");
  expect(await closeShiftAction(null, form)).toMatchObject({ ok: false });
  expect(api.closeShift).not.toHaveBeenCalled();
  form.set("amount", "10.01");
  api.closeShift.mockRejectedValueOnce(new Error("lost response"));
  expect(await closeShiftAction(null, form)).toMatchObject({ ok: false });
  api.closeShift.mockResolvedValue({});
  expect(await closeShiftAction(null, form)).toMatchObject({ ok: true });
  expect(api.closeShift.mock.calls[0]).toEqual(api.closeShift.mock.calls[1]);
});
