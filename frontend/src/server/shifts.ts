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

const movementSchema = z.object({ id: z.uuid(), shiftId: z.uuid(), requestId: z.uuid(),
  kind: z.enum(['float_topup','petty_cash','bank_deposit']), amountSatang: z.number().int().positive(),
  reason: z.string(), actorStaffId: z.uuid(), approvedByStaffId: z.uuid(), createdAt: z.string() }).strict();
export function listCashMovements(shopId: string, actorStaffId: string, shiftId: string) {
  return request(`${path(shopId)}/${z.uuid().parse(shiftId)}/movements?actorStaffId=${z.uuid().parse(actorStaffId)}`, z.array(movementSchema));
}
export function recordCashMovement(shopId: string, actorStaffId: string, shiftId: string, input: {
  requestId: string; kind: 'float_topup' | 'petty_cash' | 'bank_deposit'; amountSatang: number; reason: string;
}) {
  return request(`${path(shopId)}/${z.uuid().parse(shiftId)}/movements`, z.object({ id: z.uuid() }).strict(),
    { method: 'POST', body: JSON.stringify({ ...input, actorStaffId }) });
}

const statementSchema = z.object({
  shift: shiftSchema, closedByName: z.string().nullable(), handedToName: z.string().nullable(),
  totals: z.object({ cashSalesSatang: z.number().int().nonnegative(), cashRefundsSatang: z.number().int().nonnegative(),
    topupsSatang: z.number().int().nonnegative(), pettyCashSatang: z.number().int().nonnegative(), depositsSatang: z.number().int().nonnegative() }).strict(),
  ledgerCashSatang: z.number().int(), snapshotDifferenceSatang: z.number().int().nullable(),
  entryCount: z.number().int().nonnegative(), page: z.number().int().min(1).max(10000), pageSize: z.literal(100),
  entries: z.array(z.object({ id: z.uuid(), kind: z.enum(['sale','refund','float_topup','petty_cash','bank_deposit']),
    amountSatang: z.number().int(), occurredAt: z.string(), actorName: z.string().nullable(), approvedByName: z.string().nullable(),
    reason: z.string(), reference: z.string().nullable(), orderId: z.uuid().nullable(), dailyNo: z.number().int().nullable(), businessDate: z.string().nullable() }).strict()).max(100),
}).strict();
export type CashStatement = z.infer<typeof statementSchema>;
export async function getCashStatement(shopId: string, actorStaffId: string, shiftId: string, page = 1): Promise<CashStatement | null> {
  const validPage = z.number().int().min(1).max(10000).parse(page);
  const response = await internalApiFetch(`${path(shopId)}/${z.uuid().parse(shiftId)}/statement?actorStaffId=${z.uuid().parse(actorStaffId)}&page=${validPage}`);
  if (response.status === 404) { return null; }
  if (!response.ok) { throw new Error(`Cash statement API returned ${response.status}`); }
  return statementSchema.parse(await readInternalJson(response));
}
