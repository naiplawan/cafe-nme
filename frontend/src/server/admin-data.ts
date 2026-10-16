import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;
const dashboardSchema = z.object({
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
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required to read admin data");
  }
  return `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(shopId)}/admin-data/${resource}`;
}

async function read<T>(shopId: string, resource: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(endpoint(shopId, resource), {
    headers: { "x-internal-api-token": createInternalApiToken() },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Nest admin-data API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
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
