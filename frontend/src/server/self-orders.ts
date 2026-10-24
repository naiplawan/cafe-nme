import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";
import { selfOrderInputSchema, selfOrderLineSchema as lineSchema } from "@/app/menu/[shopSlug]/order/schema";
export { selfOrderInputSchema } from "@/app/menu/[shopSlug]/order/schema";
export type SelfOrderInput = z.infer<typeof selfOrderInputSchema>;
const viewSchema = z.object({
  id: z.uuid(), status: z.enum(["pending", "accepted", "rejected", "completed"]), totalSatang: z.number().int().nonnegative(), dailyNo: z.number().int().nullable(),
  mode: z.enum(["pickup", "table"]), tableLabel: z.string().nullable(),
  items: z.array(z.object({ id: z.uuid(), name: z.string(), qty: z.number().int(), note: z.string().nullable(), modifiers: z.array(z.string()), lineTotalSatang: z.number().int() })),
});
export type SelfOrderView = z.infer<typeof viewSchema>;
export class SelfOrderApiError extends Error { constructor(readonly status: number) { super("Self-order API request failed"); } }
async function request(path: string, init?: RequestInit) {
  const response = await internalApiFetch(path, init);
  if (!response.ok) { throw new SelfOrderApiError(response.status); }
  return readInternalJson(response);
}
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i;
export async function getSelfOrderShop(slug: string) {
  if (!SLUG_PATTERN.test(slug)) { return null; }
  return z.object({ shopId: z.uuid(), name: z.string() }).nullable().parse(await request(`/v1/liff/shops/${encodeURIComponent(slug)}`));
}
export async function submitSelfOrder(shopId: string, input: SelfOrderInput) {
  return viewSchema.parse(await request(`/v1/shops/${shopId}/self-orders`, { method: "POST", body: JSON.stringify(input) }));
}
export async function getSelfOrderStatus(shopId: string, statusToken: string) {
  return viewSchema.parse(await request(`/v1/shops/${shopId}/self-orders/status`, { method: "POST", body: JSON.stringify({ statusToken }) }));
}
export async function listSelfOrders(shopId: string, actorStaffId: string) {
  return z.array(viewSchema).parse(await request(`/v1/shops/${shopId}/self-orders?${new URLSearchParams({ actorStaffId })}`));
}
export async function decideSelfOrder(shopId: string, actorStaffId: string, id: string, decision: "accepted" | "rejected") {
  return viewSchema.parse(await request(`/v1/shops/${shopId}/self-orders/${z.uuid().parse(id)}/decision`, { method: "POST", body: JSON.stringify({ actorStaffId, decision }) }));
}
export async function getAcceptedSelfOrder(shopId: string, actorStaffId: string, id: string) {
  return z.object({ lines: z.array(lineSchema), totalSatang: z.number().int().nonnegative() }).parse(await request(`/v1/shops/${shopId}/self-orders/${z.uuid().parse(id)}/draft?${new URLSearchParams({ actorStaffId })}`));
}
