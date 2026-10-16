import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitAttempts } from "@/db/schema";
import { consumeRateLimit } from "./rate-limit";

describe("database rate limits", () => {
  const key = `test:${crypto.randomUUID()}`;

  afterAll(async () => {
    await db.delete(rateLimitAttempts).where(eq(rateLimitAttempts.key, key));
  });

  it("allows the configured number of attempts and blocks the next one", async () => {
    expect(await consumeRateLimit(key, 2, 60)).toBe(true);
    expect(await consumeRateLimit(key, 2, 60)).toBe(true);
    expect(await consumeRateLimit(key, 2, 60)).toBe(false);
  });

  it("starts a new window after the prior window expires", async () => {
    const now = new Date("2026-10-16T00:00:00.000Z");
    const expiringKey = `${key}:expires`;
    try {
      expect(await consumeRateLimit(expiringKey, 1, 60, now)).toBe(true);
      expect(await consumeRateLimit(expiringKey, 1, 60, new Date(now.getTime() + 60_001))).toBe(true);
    } finally {
      await db.delete(rateLimitAttempts).where(eq(rateLimitAttempts.key, expiringKey));
    }
  });
});
