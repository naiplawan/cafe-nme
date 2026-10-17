import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../src/config/validate-env.js";

const baseEnvironment = {
  DATABASE_URL: "postgres://localhost:5432/cafe",
  INTERNAL_API_SECRET: "a-secret-that-is-long-enough-for-validation",
};

test("email API settings are optional locally but must be configured together", () => {
  assert.equal(validateEnvironment(baseEnvironment).DATABASE_URL, baseEnvironment.DATABASE_URL);
  assert.equal(validateEnvironment({ ...baseEnvironment, RESEND_API_KEY: "", EMAIL_FROM_EMAIL: "", APP_URL: "" }).DATABASE_URL, baseEnvironment.DATABASE_URL);
  assert.throws(() => validateEnvironment({ ...baseEnvironment, RESEND_API_KEY: "re_test_key" }), /configured together/);
  assert.equal(validateEnvironment({
    ...baseEnvironment,
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM_EMAIL: "Cafe'nMe <no-reply@example.com>",
    APP_URL: "https://cafenme.example.com",
  }).APP_URL, "https://cafenme.example.com");
});
