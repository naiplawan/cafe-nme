import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

const ingredientSchema = z.object({ id: z.uuid(), name: z.string(), unit: z.enum(["g", "ml", "unit"]),
  lowStockMilliunits: z.number().int().nonnegative(), onHandMilliunits: z.number().int(), reservedMilliunits: z.number().int().optional(), availableMilliunits: z.number().int().optional(), lowStock: z.boolean() }).strict();
const recipeSchema = z.object({ targetKind: z.enum(["product", "modifier"]), targetId: z.uuid(), ingredientId: z.uuid(), replacesIngredientId: z.uuid().nullable().optional(), quantityMilliunits: z.number().int().positive() }).strict();
const targetSchema = z.object({ id: z.uuid(), name: z.string(), kind: z.enum(["product", "modifier"]) }).strict();
const movementSchema = z.object({ id: z.uuid(), ingredientId: z.uuid(), kind: z.enum(["receive", "waste", "adjust", "sale", "remake"]), quantityMilliunits: z.number().int(),
  costSatang: z.number().int().nullable().optional(), reason: z.string(), actorStaffId: z.uuid().nullable(), orderId: z.uuid().nullable(), createdAt: z.string() }).strict();
const stateSchema = z.object({ ingredients: z.array(ingredientSchema), recipes: z.array(recipeSchema), targets: z.array(targetSchema), movements: z.array(movementSchema) }).strict();
export type InventoryState = z.infer<typeof stateSchema>;
export type InventoryIngredient = z.infer<typeof ingredientSchema>;
export type InventoryRecipe = z.infer<typeof recipeSchema>;
const idSchema = z.object({ id: z.uuid() }).strict();
const path = (shopId: string) => `/v1/shops/${z.uuid().parse(shopId)}/inventory`;
export class InventoryApiError extends Error {
  constructor(readonly status: number, readonly code: string | null) {
    super(`Inventory API returned ${status}`);
    this.name = "InventoryApiError";
  }
}
async function request<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await internalApiFetch(url, init);
  if (!response.ok) {
    let code: string | null = null;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "code" in body && typeof body.code === "string") { code = body.code; }
    } catch { /* Keep the HTTP status when the API has no JSON error body. */ }
    throw new InventoryApiError(response.status, code);
  }
  return schema.parse(await readInternalJson(response));
}
export function listInventory(shopId: string, actorStaffId: string): Promise<InventoryState> {
  return request(`${path(shopId)}?actorStaffId=${z.uuid().parse(actorStaffId)}`, stateSchema);
}
export function createIngredient(shopId: string, actorStaffId: string, input: { name: string; unit: "g" | "ml" | "unit"; lowStockMilliunits: number }) {
  return request(`${path(shopId)}/ingredients`, idSchema, { method: "POST", body: JSON.stringify({ ...input, actorStaffId }) });
}
export function setInventoryThreshold(shopId: string, actorStaffId: string, ingredientId: string, lowStockMilliunits: number) {
  return request(`${path(shopId)}/ingredients/${z.uuid().parse(ingredientId)}/threshold`, idSchema,
    { method: "PUT", body: JSON.stringify({ actorStaffId, lowStockMilliunits }) });
}
export function moveInventory(shopId: string, actorStaffId: string, ingredientId: string, input: { requestId: string; kind: "receive" | "waste" | "adjust"; quantityMilliunits: number; reason: string; costSatang?: number | null }) {
  return request(`${path(shopId)}/ingredients/${z.uuid().parse(ingredientId)}/movements`, idSchema,
    { method: "POST", body: JSON.stringify({ ...input, actorStaffId }) });
}
export function saveRecipe(shopId: string, actorStaffId: string, kind: "product" | "modifier", targetId: string, lines: { ingredientId: string; quantityMilliunits: number; replacesIngredientId?: string | null }[]) {
  return request(`${path(shopId)}/${kind === "product" ? "products" : "modifiers"}/${z.uuid().parse(targetId)}/recipe`, z.object({ ok: z.literal(true) }).strict(),
    { method: "PUT", body: JSON.stringify({ actorStaffId, lines }) });
}

const stockPolicySchema = z.object({ mode: z.enum(['payment','preparation']) }).strict();
export function getStockPolicy(shopId: string, actorStaffId: string) {
  return request(`${path(shopId)}/stock-policy?actorStaffId=${z.uuid().parse(actorStaffId)}`, stockPolicySchema);
}
export function setStockPolicy(shopId: string, actorStaffId: string, mode: 'payment' | 'preparation') {
  return request(`${path(shopId)}/stock-policy`, stockPolicySchema, { method: 'PUT', body: JSON.stringify({ actorStaffId, mode }) });
}
export function remakeDrink(shopId: string, actorStaffId: string, orderId: string, itemId: string, input: { requestId: string; qty: number; reason: string }) {
  return request(`${path(shopId)}/orders/${z.uuid().parse(orderId)}/items/${z.uuid().parse(itemId)}/remakes`, idSchema,
    { method: 'POST', body: JSON.stringify({ ...input, actorStaffId }) });
}

export function valueStock(shopId: string, actorStaffId: string, ingredientId: string, input: { requestId: string; onHandMilliunits: number; costSatang: number; reason: string }) {
  return request(`${path(shopId)}/ingredients/${z.uuid().parse(ingredientId)}/valuation`, idSchema,
    { method: 'POST', body: JSON.stringify({ ...input, actorStaffId }) });
}
