import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

const viewSchema = z.object({
  id: z.uuid().nullable(), configured: z.boolean(), testMode: z.boolean().nullable(),
  status: z.enum(["not_started", "creating", "uncertain", "pending", "verified", "paid_unfulfilled", "discrepancy", "completed", "failed", "expired"]),
  amountSatang: z.number().int().nullable(), qrImageUrl: z.url().nullable(), orderId: z.uuid().nullable(), dailyNo: z.number().int().nullable(), discrepancyCode: z.string().nullable(),
});
export type ProviderPaymentView = z.infer<typeof viewSchema>;
async function request(shopId: string, actorStaffId: string, orderId: string, action?: "create" | "refresh") {
  const path = `/v1/shops/${shopId}/self-orders/${orderId}/provider-payment`;
  const endpoint = `${action === "refresh" ? `${path}/refresh` : path}${action ? "" : `?${new URLSearchParams({ actorStaffId })}`}`;
  const response = await internalApiFetch(endpoint, action ? {
    method: "POST", body: JSON.stringify({ actorStaffId }),
  } : { method: "GET" });
  if (!response.ok) { throw new Error(`Provider API returned ${response.status}`); }
  return viewSchema.parse(await readInternalJson(response));
}
export const getProviderPayment = request;
export const createProviderPayment = (shopId: string, actorStaffId: string, orderId: string) => request(shopId, actorStaffId, orderId, "create");
export const refreshProviderPayment = (shopId: string, actorStaffId: string, orderId: string) => request(shopId, actorStaffId, orderId, "refresh");
