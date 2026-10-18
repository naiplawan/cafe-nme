import assert from "node:assert/strict";
import test from "node:test";
import { loginRateLimitKey, signupRateLimitKey } from "../src/auth-security.js";

test("login rate limits are scoped to source address and cannot lock a specific account", () => {
  assert.equal(loginRateLimitKey("203.0.113.5"), "login-ip:203.0.113.5");
  assert.notEqual(loginRateLimitKey("203.0.113.5"), loginRateLimitKey("203.0.113.6"));
});

test("signup throttling is scoped to source address rather than a reclaimable email", () => {
  assert.equal(signupRateLimitKey("203.0.113.5"), "signup-ip:203.0.113.5");
  assert.notEqual(signupRateLimitKey("203.0.113.5"), signupRateLimitKey("203.0.113.6"));
});
