import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireStaff = vi.hoisted(() => vi.fn());
const getPromptPaySettings = vi.hoisted(() => vi.fn());
const savePromptPayId = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireStaff }));
vi.mock("@/server/payment-settings", () => ({ getPromptPaySettings, savePromptPayId }));
vi.mock("next/cache", () => ({ revalidatePath }));

import * as actions from "./actions";

const ownerSession = {
  userId: "user-1",
  email: "owner@example.com",
  staff: { id: "staff-1", name: "เจ้าของร้าน", role: "owner" as const },
  shop: { id: "shop-1", name: "ร้านกาแฟ" },
  shopId: "shop-1",
};

const managerSession = {
  ...ownerSession,
  staff: { ...ownerSession.staff, role: "manager" as const },
};

const emptySaveState = { message: null, success: false };

function formData(value: string) {
  const data = new FormData();
  data.set("promptpayId", value);
  return data;
}

describe("PromptPay payment actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a field-linked validation error without saving an invalid ID", async () => {
    requireStaff.mockResolvedValue(ownerSession);

    const result = await actions.savePromptPayAction("shop-1", emptySaveState, formData("123"));

    expect(result).toEqual({
      message: "กรอกเบอร์มือถือ 10 หลักหรือเลขประจำตัว 13 หลัก",
      success: false,
      fieldError: "กรอกเบอร์มือถือ 10 หลักหรือเลขประจำตัว 13 หลัก",
    });
    expect(savePromptPayId).not.toHaveBeenCalled();
  });

  it("normalizes a valid ID before saving and reports success", async () => {
    requireStaff.mockResolvedValue(ownerSession);

    const result = await actions.savePromptPayAction("shop-1", emptySaveState, formData("08 123-45678"));

    expect(savePromptPayId).toHaveBeenCalledWith("shop-1", "staff-1", "0812345678");
    expect(result).toMatchObject({ message: "บันทึก PromptPay ID แล้ว", success: true });
  });

  it("reports a save failure without exposing the saved ID", async () => {
    requireStaff.mockResolvedValue(ownerSession);
    savePromptPayId.mockRejectedValue(new Error("API unavailable"));

    const result = await actions.savePromptPayAction("shop-1", emptySaveState, formData("0812345678"));

    expect(result).toEqual({ message: "บันทึก PromptPay ID ไม่สำเร็จ กรุณาลองใหม่", success: false });
  });

  it("returns an owner-only response before reading saved settings for preview", async () => {
    requireStaff.mockResolvedValue(managerSession);

    const result = await actions.previewPromptPayAction("shop-1");

    expect(result).toEqual({ ok: false, message: "เฉพาะเจ้าของร้านเท่านั้นที่ดู QR ทดสอบได้" });
    expect(getPromptPaySettings).not.toHaveBeenCalled();
  });

  it("generates a one baht receiving QR from the saved owner ID", async () => {
    requireStaff.mockResolvedValue(ownerSession);
    getPromptPaySettings.mockResolvedValue({ promptpayId: "0812345678" });
    const qrToString = vi.spyOn(QRCode, "toString");

    const result = await actions.previewPromptPayAction("shop-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.svg).toMatch(/^<svg/);
      expect(result.svg).not.toContain("0812345678");
    }
    expect(qrToString).toHaveBeenCalledWith(expect.stringContaining("54041.00"), expect.objectContaining({ type: "svg" }));
    expect(getPromptPaySettings).toHaveBeenCalledWith("shop-1", "staff-1");
    expect(savePromptPayId).not.toHaveBeenCalled();
  });

  it("does not generate a QR when the saved ID is empty", async () => {
    requireStaff.mockResolvedValue(ownerSession);
    getPromptPaySettings.mockResolvedValue({ promptpayId: null });

    const result = await actions.previewPromptPayAction("shop-1");

    expect(result).toEqual({ ok: false, message: "ร้านยังไม่ได้ตั้งค่าพร้อมเพย์" });
  });

  it("renders a clear error when saved settings cannot be read", async () => {
    requireStaff.mockResolvedValue(ownerSession);
    getPromptPaySettings.mockRejectedValue(new Error("API unavailable"));

    const result = await actions.previewPromptPayAction("shop-1");

    expect(result).toEqual({ ok: false, message: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" });
  });

  it("preserves the authentication failure thrown by the session guard", async () => {
    const authFailure = new Error("session unavailable");
    requireStaff.mockRejectedValue(authFailure);

    await expect(actions.previewPromptPayAction("shop-1")).rejects.toBe(authFailure);
  });
  it("rejects stale save, clear and preview requests after another tab switches shops", async () => {
    requireStaff.mockResolvedValue({ ...ownerSession, shopId: "shop-2", shop: { id: "shop-2", name: "Other branch" } });
    getPromptPaySettings.mockResolvedValue({ promptpayId: "0812345678" });

    expect(await actions.previewPromptPayAction("shop-1")).toMatchObject({ ok: false });
    expect(await actions.savePromptPayAction("shop-1", emptySaveState, formData("0812345678"))).toMatchObject({ success: false });
    expect(await actions.clearPromptPayAction("shop-1", emptySaveState)).toMatchObject({ success: false });
    expect(savePromptPayId).not.toHaveBeenCalled();
    expect(getPromptPaySettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("clears only the current owner's expected shop", async () => {
    requireStaff.mockResolvedValue(ownerSession);
    expect(await actions.clearPromptPayAction("shop-1", emptySaveState)).toMatchObject({ success: true });
    expect(savePromptPayId).toHaveBeenCalledWith("shop-1", "staff-1", null);
  });

  it("rejects non-owner writes even with a matching shop", async () => {
    requireStaff.mockResolvedValue(managerSession);
    expect(await actions.savePromptPayAction("shop-1", emptySaveState, formData("0812345678"))).toMatchObject({ success: false });
    expect(await actions.clearPromptPayAction("shop-1", emptySaveState)).toMatchObject({ success: false });
    expect(savePromptPayId).not.toHaveBeenCalled();
  });

});
