import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;
const soldOutResultSchema = z.object({ soldOut: z.boolean() }).nullable();
const promptPayConfigSchema = z.object({ promptpayId: z.string().nullable() }).nullable();
const receiptRecipientSchema = z.object({
  dailyNo: z.number().int(),
  hasMember: z.boolean(),
  lineUserId: z.string().nullable(),
}).nullable();

function apiUrl(shopId: string, path: string) {
  const baseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!baseUrl) throw new Error("API_BASE_URL is required for POS operations");
  return `${baseUrl.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(shopId)}${path}`;
}

async function request<T>(path: string, schema: z.ZodType<T>, method = "GET"): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "x-internal-api-token": createInternalApiToken() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nest POS API returned ${response.status}`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest POS API returned an invalid payload");
  return parsed.data;
}

export function togglePosProductSoldOut(shopId: string, productId: string) {
  return request(
    apiUrl(shopId, `/menu/products/${encodeURIComponent(productId)}/toggle-sold-out`),
    soldOutResultSchema,
    "POST",
  );
}

export function getPosPromptPayConfig(shopId: string) {
  return request(apiUrl(shopId, "/orders/promptpay-config"), promptPayConfigSchema);
}

export function getPosReceiptRecipient(shopId: string, orderId: string) {
  return request(
    apiUrl(shopId, `/orders/${encodeURIComponent(orderId)}/receipt-recipient`),
    receiptRecipientSchema,
  );
}
