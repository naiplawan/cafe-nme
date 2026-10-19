import "server-only";
import { z } from "zod";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";

const soldOutResultSchema = z.object({ soldOut: z.boolean() }).nullable();
const promptPayConfigSchema = z.object({ promptpayId: z.string().nullable() }).nullable();
const receiptRecipientSchema = z.object({
  dailyNo: z.number().int(),
  hasMember: z.boolean(),
  lineUserId: z.string().nullable(),
}).nullable();

function apiUrl(shopId: string, path: string) {
  return internalApiUrl(`/v1/shops/${encodeURIComponent(shopId)}${path}`, "API_BASE_URL is required for POS operations");
}

async function request<T>(path: string, schema: z.ZodType<T>, method = "GET"): Promise<T> {
  const response = await internalApiFetch(path, {
    method,
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
