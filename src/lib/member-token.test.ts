import { afterEach, describe, expect, it } from "vitest";
import { createMemberToken, verifyMemberToken } from "./member-token";
import { sign } from "./signing";

const originalSecret = process.env.APP_SECRET;
const now = new Date("2026-10-13T05:01:10.000Z");

afterEach(() => {
  if (originalSecret === undefined) delete process.env.APP_SECRET;
  else process.env.APP_SECRET = originalSecret;
});

describe("member QR token", () => {
  it("accepts the current and previous 60 second windows", () => {
    process.env.APP_SECRET = "test-secret-that-is-at-least-32-characters-long";
    const current = createMemberToken("member-123", now);
    const previous = createMemberToken("member-123", new Date(now.getTime() - 60_000));
    expect(verifyMemberToken(current, now)).toBe("member-123");
    expect(verifyMemberToken(previous, now)).toBe("member-123");
  });

  it("rejects expired windows and malformed or other-purpose signatures", () => {
    process.env.APP_SECRET = "test-secret-that-is-at-least-32-characters-long";
    const expired = createMemberToken("member-123", new Date(now.getTime() - 120_000));
    const window = Math.floor(now.getTime() / 60_000);
    const wrongPurpose = sign(`member-123.${window}`, "another-purpose").split(".").at(-1);
    expect(verifyMemberToken(expired, now)).toBeNull();
    expect(verifyMemberToken("not-a-token", now)).toBeNull();
    expect(verifyMemberToken(`CM1.member-123.${window}.${wrongPurpose}`, now)).toBeNull();
  });
});
