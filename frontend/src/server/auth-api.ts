import "server-only";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;

function apiUrl(path: string) {
  const baseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!baseUrl) {
    throw new Error("API_BASE_URL is required for authentication");
  }
  return `${baseUrl.replace(TRAILING_SLASH, "")}/v1/auth${path}`;
}

export function requestAuthApi(path: string, options: { method?: "GET" | "POST"; body?: unknown; token?: string; clientAddress?: string } = {}) {
  return fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.clientAddress ? { "x-client-address": options.clientAddress } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });
}

export const AUTH_COOKIE_NAME = "cafenme_session";
