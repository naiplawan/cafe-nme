import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const MAX_KEY_LENGTH = 4096;
const MAX_LIMIT = 2_147_483_646;
const MAX_WINDOW_SECONDS = 31_536_000;
const TRAILING_SLASH = /\/$/;

const consumeRequestSchema = z.object({
  key: z.string().min(1).max(MAX_KEY_LENGTH),
  limit: z.number().int().min(1).max(MAX_LIMIT),
  windowSeconds: z.number().int().min(1).max(MAX_WINDOW_SECONDS),
  now: z.iso.datetime({ offset: true }),
});

const consumeResponseSchema = z.object({ allowed: z.boolean() });

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number, now = new Date()): Promise<boolean> {
  const request = consumeRequestSchema.parse({ key, limit, windowSeconds, now: now.toISOString() });
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required to consume rate limits");
  }

  const response = await fetch(`${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/rate-limits/consume`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-token": createInternalApiToken(),
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Nest rate-limit API returned ${response.status}`);
  }

  const parsed = consumeResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest rate-limit API returned an invalid response");
  }
  return parsed.data.allowed;
}
