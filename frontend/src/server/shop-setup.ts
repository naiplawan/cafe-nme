import "server-only";
import { z } from "zod";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";
const ownerExistsSchema = z.object({ exists: z.boolean() });
const createShopSchema = z.object({ status: z.literal("created"), shopId: z.uuid() });

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await internalApiFetch(internalApiUrl(path, "API_BASE_URL is required to set up a shop"), init);
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
