import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const originalSecret = process.env.APP_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.APP_SECRET;
  else process.env.APP_SECRET = originalSecret;
});

describe("LINE credential encryption", () => {
  it("round trips a secret without storing it as plaintext", () => {
    process.env.APP_SECRET = "test-secret-that-is-at-least-32-characters-long";
    const encrypted = encryptSecret("channel-secret");
    expect(encrypted).not.toContain("channel-secret");
    expect(decryptSecret(encrypted)).toBe("channel-secret");
  });
});
