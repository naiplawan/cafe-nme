import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;
const settingsSchema = z.object({ promptpayId: z.string().nullable() }).strict();
const successSchema = z.object({ success: z.literal(true) }).strict();

function endpoint(shopId: string, suffix = "") {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) throw new Error("API_BASE_URL is required to access payment settings");
  return `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(shopId)}/payment-settings/promptpay${suffix}`;
}

async function request(shopId: string, options: RequestInit) {
  return fetch(endpoint(shopId), {
    ...options,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...options.headers,
    },
    cache: "no-store",
  });
}

async function throwApiError(response: Response): Promise<never> {
  let message = `Nest payment-settings API returned ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const detail = body.message;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail) && detail.every((item) => typeof item === "string")) message = detail.join(", ");
    }
  } catch {
    // Keep the status error when the API has no JSON response.
  }
  throw new Error(message);
}

export async function getPromptPaySettings(shopId: string, actorStaffId: string) {
  const response = await fetch(endpoint(shopId, `?actorStaffId=${encodeURIComponent(actorStaffId)}`), {
    headers: { "x-internal-api-token": createInternalApiToken() },
    cache: "no-store",
  });
  if (!response.ok) return throwApiError(response);
  const parsed = settingsSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest payment-settings API returned an invalid payload");
  return parsed.data;
}

export async function savePromptPayId(shopId: string, actorStaffId: string, promptpayId: string | null) {
  const response = await request(shopId, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actorStaffId, promptpayId }),
  });
  if (!response.ok) return throwApiError(response);
  const parsed = successSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest payment-settings API returned an invalid response");
}
