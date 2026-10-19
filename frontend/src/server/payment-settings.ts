import "server-only";
import { z } from "zod";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";
const settingsSchema = z.object({ promptpayId: z.string().nullable() }).strict();
const successSchema = z.object({ success: z.literal(true) }).strict();

function endpoint(shopId: string, suffix = "") {
  return internalApiUrl(`/v1/shops/${encodeURIComponent(shopId)}/payment-settings/promptpay${suffix}`, "API_BASE_URL is required to access payment settings");
}

async function request(shopId: string, options: RequestInit) {
  return internalApiFetch(endpoint(shopId), {
    ...options,
    headers: {
      ...options.headers,
    },
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
  const response = await internalApiFetch(endpoint(shopId, `?actorStaffId=${encodeURIComponent(actorStaffId)}`));
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
