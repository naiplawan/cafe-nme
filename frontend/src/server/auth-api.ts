import "server-only";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";

export function requestAuthApi(path: string, options: { method?: "GET" | "POST"; body?: unknown; token?: string; clientAddress?: string } = {}) {
  return internalApiFetch(internalApiUrl(`/v1/auth${path}`, "API_BASE_URL is required for authentication"), {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.clientAddress ? { "x-client-address": options.clientAddress } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

export const AUTH_COOKIE_NAME = "cafenme_session";
