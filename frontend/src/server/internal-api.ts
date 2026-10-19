import "server-only";
import { createInternalApiToken } from "@/lib/internal-api-token";

const TRAILING_SLASH = /\/$/;

export function internalApiUrl(path: string, missingMessage = "API_BASE_URL is required to access internal API"): string {
  const baseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!baseUrl) {
    throw new Error(missingMessage);
  }
  return `${baseUrl.replace(TRAILING_SLASH, "")}${path}`;
}

export function internalApiFetch(path: string | URL, init: RequestInit = {}, missingMessage?: string): Promise<Response> {
  let url: string | URL;
  if (path instanceof URL || /^https?:\/\//.test(path)) {
    url = path;
  } else {
    url = internalApiUrl(path, missingMessage);
  }
  return fetch(url, {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
    cache: "no-store",
  });
}
