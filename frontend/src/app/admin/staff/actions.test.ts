import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaff = vi.hoisted(() => vi.fn());
const createAdminStaff = vi.hoisted(() => vi.fn());
const listAdminStaff = vi.hoisted(() => vi.fn());
const setAdminStaffActive = vi.hoisted(() => vi.fn());
const setAdminStaffPin = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireStaff }));
vi.mock("@/server/pos-session", () => ({
  createAdminStaff,
  listAdminStaff,
  setAdminStaffActive,
  setAdminStaffPin,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { setStaffActiveAction, setStaffPinAction } from "./actions";

const ownerSession = {
  shopId: "shop-1",
  staff: { id: "staff-owner", role: "owner" as const },
};

function pinFormData(pin: string) {
  const data = new FormData();
  data.set("pin", pin);
  return data;
}

describe("staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaff.mockResolvedValue(ownerSession);
  });

  it("reports a successful PIN update without returning the PIN", async () => {
    setAdminStaffPin.mockResolvedValue(undefined);

    const result = await setStaffPinAction("staff-barista", { message: null }, pinFormData("1234"));

    expect(result).toEqual({ message: "เปลี่ยน PIN แล้ว", success: true });
    expect(JSON.stringify(result)).not.toContain("1234");
    expect(setAdminStaffPin).toHaveBeenCalledWith("shop-1", "staff-owner", "staff-barista", "1234");
  });

  it("returns a safe error when the PIN service fails", async () => {
    setAdminStaffPin.mockRejectedValue(new Error("database details"));

    const result = await setStaffPinAction("staff-barista", { message: null }, pinFormData("1234"));

    expect(result).toEqual({ message: "เปลี่ยน PIN ไม่สำเร็จ กรุณาลองใหม่", success: false });
    expect(result.message).not.toContain("database");
    expect(result.message).not.toContain("1234");
  });

  it("reports a successful account deactivation", async () => {
    listAdminStaff.mockResolvedValue([{ id: "staff-barista", role: "barista" }]);
    setAdminStaffActive.mockResolvedValue(undefined);

    const result = await setStaffActiveAction("staff-barista", false, { message: null }, new FormData());

    expect(result).toEqual({ message: "ปิดใช้งานบัญชีแล้ว", success: true });
  });
});
