import "server-only";
import { z } from "zod";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";
const UUID = z.uuid();
const staffSessionSchema = z.object({
  staff: z.object({
    id: UUID,
    name: z.string(),
    role: z.enum(["owner", "manager", "barista"]),
  }).strict(),
  shop: z.object({ id: UUID, name: z.string() }).strict(),
  shopId: UUID,
}).strict().nullable();
const staffShopsSchema = z.array(z.object({
  staff: z.object({ id: UUID, name: z.string(), role: z.enum(["owner", "manager", "barista"]) }).strict(),
  shop: z.object({ id: UUID, name: z.string() }).strict(),
  shopId: UUID,
}).strict());

export async function findStaffShops(authUserId: string) {
  const userId = UUID.parse(authUserId);
  const response = await internalApiFetch(
    internalApiUrl(`/v1/auth-users/${encodeURIComponent(userId)}/shops`, "API_BASE_URL is required to access staff sessions"),
  );

  if (!response.ok) {
    throw new Error(`Nest staff shops API returned ${response.status}`);
  }
  const parsed = staffShopsSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest staff shops API returned an invalid payload");
  }
  return parsed.data;
}

export async function findStaffSession(authUserId: string, shopId: string) {
  const userId = UUID.parse(authUserId);
  const selectedShopId = UUID.parse(shopId);
  const response = await internalApiFetch(
    internalApiUrl(`/v1/auth-users/${encodeURIComponent(userId)}/shops/${encodeURIComponent(selectedShopId)}/staff-session`, "API_BASE_URL is required to access staff sessions"),
  );

  if (!response.ok) {
    throw new Error(`Nest staff session API returned ${response.status}`);
  }
  const parsed = staffSessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest staff session API returned an invalid payload");
  }
  return parsed.data;
}
