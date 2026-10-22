import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ requestAuthApi: vi.fn() }));
vi.mock("./auth-api", () => api);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "127.0.0.1" }) }));
import { requestPasswordReset, confirmPasswordReset } from "./password-recovery-actions";
afterEach(() => vi.resetAllMocks());
it("reports request outages without claiming an email was delivered", async () => {
  api.requestAuthApi.mockRejectedValue(new Error("offline"));
  const data = new FormData(); data.set("email", "owner@example.com");
  const result = await requestPasswordReset({ message: "" }, data);
  expect(result.success).not.toBe(true); expect(result.email).toBe("owner@example.com");
  expect(result.message).toContain("เชื่อมต่อไม่ได้");
});
it("rejects mismatched passwords before submission and explains expired links", async () => {
  const data = new FormData(); data.set("token", "x".repeat(43)); data.set("password", "new-password"); data.set("confirmPassword", "different-password");
  expect((await confirmPasswordReset({ message: "" }, data)).message).toContain("ไม่ตรงกัน");
  expect(api.requestAuthApi).not.toHaveBeenCalled();
  data.set("confirmPassword", "new-password"); api.requestAuthApi.mockResolvedValue(new Response("{}", { status: 400 }));
  expect((await confirmPasswordReset({ message: "" }, data)).message).toContain("ลิงก์หมดอายุ");
});
