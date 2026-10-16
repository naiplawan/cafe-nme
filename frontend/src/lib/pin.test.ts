import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, verifyPin } from "./pin";

describe("PIN helpers", () => {
  it("accepts only 4 to 6 decimal digits", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("hashes a valid PIN in the scrypt format and verifies it", async () => {
    const hash = await hashPin("2468");
    const [algorithm, salt, digest] = hash.split("$");
    expect(algorithm).toBe("scrypt");
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(digest, "base64").length).toBeGreaterThan(0);
    expect(await verifyPin("2468", hash)).toBe(true);
    expect(await verifyPin("2469", hash)).toBe(false);
  });

  it("rejects invalid PINs and malformed hashes", async () => {
    await expect(hashPin("12a4")).rejects.toThrow();
    expect(await verifyPin("123", "scrypt$bad$bad")).toBe(false);
    expect(await verifyPin("1234", "broken")).toBe(false);
  });
});
