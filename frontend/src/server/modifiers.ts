import "server-only";
import { z } from "zod";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";
const optionSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  name: z.string(),
  priceDeltaSatang: z.number().int(),
  sort: z.number().int(),
});
const groupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  minSelect: z.number().int(),
  maxSelect: z.number().int(),
  sort: z.number().int(),
  modifiers: z.array(optionSchema),
  productIds: z.array(z.uuid()),
  productNames: z.array(z.string()),
});
const idSchema = z.object({ id: z.uuid() });
const idRowsSchema = z.array(idSchema);
const createdGroupSchema = z.object({ id: z.uuid() });
const standardGroupsResultSchema = z.object({ created: z.number().int(), linkedProducts: z.number().int() });
const setProductsResultSchema = z.object({ success: z.literal(true) });

function modifiersUrl(shopId: string, suffix = "") {
  return internalApiUrl(`/v1/shops/${encodeURIComponent(shopId)}/modifiers${suffix}`, "API_BASE_URL is required to manage modifiers");
}

async function requestModifiers<T>(
  shopId: string,
  suffix: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const response = await internalApiFetch(modifiersUrl(shopId, suffix), {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Nest modifiers API returned ${response.status}`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest modifiers API returned an invalid payload");
  return parsed.data;
}

export async function listModifierGroups(shopId: string) {
  return requestModifiers(shopId, "", "GET", z.array(groupSchema));
}

export async function createModifierGroup(
  shopId: string,
  input: { name: string; minSelect: number; maxSelect: number },
) {
  return requestModifiers(shopId, "/groups", "POST", createdGroupSchema, input);
}

export async function createStandardModifierGroups(shopId: string) {
  return requestModifiers(shopId, "/groups/standard", "POST", standardGroupsResultSchema, {});
}

export async function setGroupProducts(shopId: string, groupId: string, productIds: string[]) {
  return requestModifiers(shopId, `/groups/${encodeURIComponent(groupId)}/products`, "PUT", setProductsResultSchema, { productIds });
}

export async function updateModifierGroup(
  shopId: string,
  groupId: string,
  input: { name: string; minSelect: number; maxSelect: number },
) {
  return requestModifiers(shopId, `/groups/${encodeURIComponent(groupId)}`, "PATCH", idRowsSchema, input);
}

export async function deleteModifierGroup(shopId: string, groupId: string) {
  return requestModifiers(shopId, `/groups/${encodeURIComponent(groupId)}`, "DELETE", idRowsSchema);
}

export async function createModifier(
  shopId: string,
  groupId: string,
  input: { name: string; priceDeltaSatang: number },
) {
  return requestModifiers(shopId, `/groups/${encodeURIComponent(groupId)}/options`, "POST", createdGroupSchema, input);
}

export async function updateModifier(
  shopId: string,
  modifierId: string,
  input: { name: string; priceDeltaSatang: number },
) {
  return requestModifiers(shopId, `/options/${encodeURIComponent(modifierId)}`, "PATCH", idRowsSchema, input);
}

export async function deleteModifier(shopId: string, modifierId: string) {
  return requestModifiers(shopId, `/options/${encodeURIComponent(modifierId)}`, "DELETE", idRowsSchema);
}
