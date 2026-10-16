import "server-only";
import { posMenuSchema, type PosMenu } from "@/lib/validation/pos-menu";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;

export async function getPosMenu(shopId: string): Promise<PosMenu> {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required to read the POS catalog");
  }

  const response = await fetch(
    `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(shopId)}/pos-menu`,
    {
      headers: { "x-internal-api-token": createInternalApiToken() },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Nest catalog API returned ${response.status}`);
  }

  const parsed = posMenuSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest catalog API returned an invalid menu payload");
  }
  return parsed.data;
}
