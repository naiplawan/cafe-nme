import { describe, expect, it } from "vitest";
import { getLiffErrorMessage } from "./member-app";

describe("getLiffErrorMessage", () => {
  it("explains when the shop has not configured LINE", () => {
    expect(getLiffErrorMessage(new Error("liffId is necessary for liff.init()"), "")).toBe("ร้านยังไม่ได้ตั้งค่า LINE");
  });

  it("asks members to reopen the page from LINE when LIFF initialization fails", () => {
    expect(getLiffErrorMessage(new Error("liff.init failed"), "configured-id")).toBe("เปิดหน้านี้จากแอป LINE อีกครั้ง");
  });

  it("uses the LINE recovery message even when LIFF failures have a generic error", () => {
    expect(getLiffErrorMessage(new Error("network error"), "configured-id", true)).toBe("เปิดหน้านี้จากแอป LINE อีกครั้ง");
  });

  it("uses a retryable Thai message for other failures", () => {
    expect(getLiffErrorMessage(new Error("database unavailable"), "configured-id")).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  });
});
