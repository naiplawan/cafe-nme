import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

const planSchema = z.enum(["basic", "pro"]);
const featureSchema = z.enum(["core-pos", "reports", "shifts", "refunds", "public-menu", "self-order", "inventory-write", "shared-loyalty"]);
const paymentSchema = z.object({ id: z.uuid(), plan: planSchema, paidAmountSatang: z.number().int().positive(), periodDays: z.number().int().positive(),
  periodStartsAt: z.iso.datetime(), periodEndsAt: z.iso.datetime(), externalReceiptRef: z.string(), recordedByStaffId: z.uuid(), recordedByUserId: z.uuid(), createdAt: z.iso.datetime() }).strict();
const stateSchema = z.object({ plan: planSchema, effectivePlan: planSchema, status: z.enum(["trial", "active", "expired"]),
  trialStartedAt: z.iso.datetime(), trialEndsAt: z.iso.datetime(), paidUntil: z.iso.datetime().nullable(),
  canRecordPayment: z.boolean(), allowedFeatures: z.array(featureSchema), payments: z.array(paymentSchema) }).strict();
export type SubscriptionState = z.infer<typeof stateSchema>;
export interface ManualRenewalInput { requestId: string; plan: "basic" | "pro"; paidAmountSatang: number; periodDays: number; externalReceiptRef: string }
const path = (shopId: string) => `/v1/shops/${z.uuid().parse(shopId)}/subscription`;
async function request<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await internalApiFetch(url, init);
  if (!response.ok) { throw new Error(`Subscription API returned ${response.status}`); }
  return schema.parse(await readInternalJson(response));
}
export function getSubscription(shopId: string, actorStaffId: string, actorUserId: string): Promise<SubscriptionState> {
  return request(`${path(shopId)}?actorStaffId=${z.uuid().parse(actorStaffId)}&actorUserId=${z.uuid().parse(actorUserId)}`, stateSchema);
}
export function recordManualRenewal(shopId: string, actorStaffId: string, actorUserId: string, input: ManualRenewalInput) {
  return request(`${path(shopId)}/manual-renewals`, z.object({ id: z.uuid() }).strict(),
    { method: "POST", body: JSON.stringify({ ...input, actorStaffId, actorUserId }) });
}
