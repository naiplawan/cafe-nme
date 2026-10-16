import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;
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

function apiBaseUrl() {
  const base = process.env.API_BASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101");
  if (!base) {
    throw new Error("API_BASE_URL is required to access staff sessions");
  }
  return base.replace(TRAILING_SLASH, "");
}

export async function findStaffSession(authUserId: string) {
  const userId = UUID.parse(authUserId);
  const response = await fetch(
    `${apiBaseUrl()}/v1/auth-users/${encodeURIComponent(userId)}/staff-session`,
    {
      headers: { "x-internal-api-token": createInternalApiToken() },
      cache: "no-store",
    },
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
