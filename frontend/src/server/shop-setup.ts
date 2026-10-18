import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;
const ownerExistsSchema = z.object({ exists: z.boolean() });
const createShopSchema = z.object({ status: z.literal("created"), shopId: z.uuid() });

function apiUrl(path: string) {
  const baseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!baseUrl) {
    throw new Error("API_BASE_URL is required to set up a shop");
  }
  return `${baseUrl.replace(TRAILING_SLASH, "")}${path}`;
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Nest shop setup API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest shop setup API returned an invalid payload");
  }
  return parsed.data;
}

export async function ownerShopExists(authUserId: string): Promise<boolean> {
  const result = await request(
    `/v1/auth-users/${encodeURIComponent(authUserId)}/owner-shop`,
    ownerExistsSchema,
  );
  return result.exists;
}

export async function createShopInApi(input: {
  authUserId: string;
  shopName: string;
  slug: string;
  ownerName: string;
  promptpayId: string | null;
  pin: string;
}): Promise<string> {
  const result = await request("/v1/shops/setup", createShopSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.shopId;
}
