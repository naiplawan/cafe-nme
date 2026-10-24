import "server-only";
import { z } from "zod";
import { readInternalJson, internalApiFetch, internalApiUrl } from "@/server/internal-api";
const dashboardSchema = z.object({
  trialSetup: z.boolean().default(false),
  activeProducts: z.number(),
  allProducts: z.number(),
  categoryCount: z.number(),
  groupCount: z.number(),
  modifierSetup: z.number(),
  ownerPinSetup: z.boolean(),
  deviceSetup: z.boolean(),
  lineSetup: z.boolean(),
  brandSetup: z.boolean(),
});
const modifierProductsSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
}));
const shopProfileSchema = z.object({ name: z.string(), slug: z.string() }).nullable();

function endpoint(shopId: string, resource: string) {
  return internalApiUrl(`/v1/shops/${encodeURIComponent(shopId)}/admin-data/${resource}`, "API_BASE_URL is required to read admin data");
}

async function read<T>(shopId: string, resource: string, schema: z.ZodType<T>): Promise<T> {
  const response = await internalApiFetch(endpoint(shopId, resource));
  if (!response.ok) {
    throw new Error(`Nest admin-data API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await readInternalJson(response));
  if (!parsed.success) {
    throw new Error("Nest admin-data API returned an invalid payload");
  }
  return parsed.data;
}

export function getAdminDashboardData(shopId: string) {
  return read(shopId, "dashboard", dashboardSchema);
}

export function getModifierProducts(shopId: string) {
  return read(shopId, "modifier-products", modifierProductsSchema);
}

export function getShopProfile(shopId: string) {
  return read(shopId, "profile", shopProfileSchema);
}
