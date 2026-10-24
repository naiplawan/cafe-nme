import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

const shiftSchema = z.object({
  id: z.uuid(), openedBy: z.uuid(), openedByName: z.string(), openingFloatSatang: z.number().int().nonnegative(),
  openedAt: z.string(), closedAt: z.string().nullable(), closedBy: z.uuid().nullable(),
  expectedCashSatang: z.number().int(), countedCashSatang: z.number().int().nonnegative().nullable(),
  differenceSatang: z.number().int().nullable(), handedToStaffId: z.uuid().nullable(),
}).strict();
const stateSchema = z.object({ shifts: z.array(shiftSchema), recipients: z.array(z.object({ id: z.uuid(), name: z.string() }).strict()) }).strict();
export type ShiftRow = z.infer<typeof shiftSchema>;
export type ShiftState = z.infer<typeof stateSchema>;

const path = (shopId: string) => `/v1/shops/${z.uuid().parse(shopId)}/shifts`;
async function request<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await internalApiFetch(url, init);
  if (!response.ok) { throw new Error(`Shift API returned ${response.status}`); }
  return schema.parse(await readInternalJson(response));
}
export function listShifts(shopId: string, actorStaffId: string): Promise<ShiftState> {
  return request(`${path(shopId)}?actorStaffId=${z.uuid().parse(actorStaffId)}`, stateSchema);
}
export function openShift(shopId: string, actorStaffId: string, input: { requestId: string; openingFloatSatang: number }): Promise<ShiftRow> {
  return request(path(shopId), shiftSchema, { method: "POST", body: JSON.stringify({ ...input, actorStaffId }) });
}
export function closeShift(shopId: string, actorStaffId: string, shiftId: string, input: { requestId: string; countedCashSatang: number; handedToStaffId?: string | null }): Promise<ShiftRow> {
  return request(`${path(shopId)}/${z.uuid().parse(shiftId)}/close`, shiftSchema, { method: "POST", body: JSON.stringify({ ...input, actorStaffId }) });
}
