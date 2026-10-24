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

import { createStaffAction, setStaffActiveAction, setStaffPinAction } from "./actions";

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
    vi.resetAllMocks();
    listAdminStaff.mockResolvedValue([{ id: "staff-owner", role: "owner" }, { id: "staff-barista", role: "barista" }]);
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

describe("staff role hierarchy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireStaff.mockResolvedValue({ shopId: "shop-1", staff: { id: "staff-manager", role: "manager" } });
    listAdminStaff.mockResolvedValue([{ id: "staff-owner", role: "owner", isActive: false }, { id: "staff-barista", role: "barista", isActive: true }]);
  });
  it("rejects owner creation by a manager", async () => {
    const data = pinFormData("1234");
    data.set("name", "Owner"); data.set("role", "owner");
    expect((await createStaffAction({ message: null }, data)).success).not.toBe(true);
    expect(createAdminStaff).not.toHaveBeenCalled();
  });
  it.each(["manager", "barista"])("allows manager to create %s", async (role) => {
    const data = pinFormData("1234"); data.set("name", "New staff"); data.set("role", role);
    expect((await createStaffAction({ message: null }, data)).success).toBe(true);
    expect(createAdminStaff).toHaveBeenCalledWith("shop-1", "staff-manager", { name: "New staff", role, pin: "1234" });
  });
  it("rejects owner PIN reset by a manager", async () => {
    expect((await setStaffPinAction("staff-owner", { message: null }, pinFormData("1234"))).success).not.toBe(true);
    expect(setAdminStaffPin).not.toHaveBeenCalled();
  });
  it.each([true, false])("rejects owner activity change to %s by manager", async (active) => {
    expect((await setStaffActiveAction("staff-owner", active, { message: null }, new FormData())).success).not.toBe(true);
    expect(setAdminStaffActive).not.toHaveBeenCalled();
  });
  it("rejects targets outside the session shop", async () => {
    expect((await setStaffPinAction("other-shop-staff", { message: null }, pinFormData("1234"))).success).not.toBe(true);
    expect((await setStaffActiveAction("other-shop-staff", true, { message: null }, new FormData())).success).not.toBe(true);
    expect(setAdminStaffPin).not.toHaveBeenCalled();
    expect(setAdminStaffActive).not.toHaveBeenCalled();
  });
});
