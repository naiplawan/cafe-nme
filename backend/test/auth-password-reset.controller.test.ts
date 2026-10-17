import assert from "node:assert/strict";
import test from "node:test";
import { AuthController } from "../src/auth.controller.js";

test("password recovery endpoints delegate to the auth service", async () => {
  const calls: unknown[][] = [];
  const auth = {
    requestPasswordReset: async (email: string) => {
      calls.push(["request", email]);
      return { status: "accepted" };
    },
    resetPassword: async (token: string, password: string) => {
      calls.push(["reset", token, password]);
      return { status: "password_updated" };
    },
    resendEmailVerification: async (email: string) => {
      calls.push(["resend-verification", email]);
      return { status: "accepted" };
    },
    confirmEmailVerification: async (token: string) => {
      calls.push(["confirm-verification", token]);
      return { status: "email_verified" };
    },
  };
  const controller = new AuthController(auth as never);

  assert.deepEqual(await controller.requestPasswordReset({ email: "guest@example.com" }), { status: "accepted" });
  assert.deepEqual(await controller.resetPassword({ token: "one-time-token", password: "new-password" }), { status: "password_updated" });
  assert.deepEqual(await controller.resendEmailVerification({ email: "guest@example.com" }), { status: "accepted" });
  assert.deepEqual(await controller.confirmEmailVerification({ token: "verification-token-that-is-long-enough" }), { status: "email_verified" });
  assert.deepEqual(calls, [
    ["request", "guest@example.com"],
    ["reset", "one-time-token", "new-password"],
    ["resend-verification", "guest@example.com"],
    ["confirm-verification", "verification-token-that-is-long-enough"],
  ]);
});
