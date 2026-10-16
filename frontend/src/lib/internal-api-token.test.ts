import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createInternalApiToken } from "./internal-api-token";

const originalInternalApiSecret = process.env.INTERNAL_API_SECRET;
const originalAppSecret = process.env.APP_SECRET;

afterEach(() => {
  if (originalInternalApiSecret === undefined) {
    delete process.env.INTERNAL_API_SECRET;
  } else {
    process.env.INTERNAL_API_SECRET = originalInternalApiSecret;
  }
  if (originalAppSecret === undefined) {
    delete process.env.APP_SECRET;
  } else {
    process.env.APP_SECRET = originalAppSecret;
  }
});

describe("createInternalApiToken", () => {
  it("uses INTERNAL_API_SECRET when configured", () => {
    process.env.APP_SECRET = "a".repeat(32);
    process.env.INTERNAL_API_SECRET = "i".repeat(32);

    const expected = createHmac("sha256", "i".repeat(32))
      .update("cafe-pos:internal-api-v1")
      .digest("hex");

    expect(createInternalApiToken()).toBe(expected);
  });
});
