import { describe, expect, it } from "vitest";
import { sign, unsign } from "./signing";

const secret = "x".repeat(32);

describe("sign/unsign", () => {
  it("round-trips a value", () => {
    expect(unsign(sign("abc.123", "pos", secret), "pos", secret)).toBe("abc.123");
  });

  it("rejects a tampered value", () => {
    const signed = sign("staff-1", "pos", secret);
    expect(unsign(signed.replace("staff-1", "staff-2"), "pos", secret)).toBeNull();
  });

  it("rejects a token signed for another purpose", () => {
    expect(unsign(sign("m1", "member-qr", secret), "pos", secret)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(unsign("no-signature", "pos", secret)).toBeNull();
    expect(unsign(".abc", "pos", secret)).toBeNull();
  });

  it("refuses to run without a strong secret", () => {
    expect(() => sign("v", "pos", "short")).toThrow();
  });
});
