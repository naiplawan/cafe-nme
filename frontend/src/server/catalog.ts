import "server-only";
import { posMenuSchema, type PosMenu } from "@/lib/validation/pos-menu";
import { internalApiFetch } from "@/server/internal-api";

export async function getPosMenu(shopId: string): Promise<PosMenu> {
  const response = await internalApiFetch(
    `/v1/shops/${encodeURIComponent(shopId)}/pos-menu`,
    {},
    "API_BASE_URL is required to read the POS catalog",
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
