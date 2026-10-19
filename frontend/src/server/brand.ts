import "server-only";
import { z } from "zod";
import { brandLogoUrl, DEFAULT_ACCENT, LOGO_MAX_BYTES, normalizeHex, sniffImageMime } from "@/lib/brand";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";

export interface ShopBrand {
  /** Resolved accent: the shop's own, or DEFAULT_ACCENT. */
  accent: string;
  hasCustomAccent: boolean;
  /** Cache-busted public URL, or null when the shop has no logo (use /assets/logo-mark.png). */
  logoUrl: string | null;
}

const MAX_BASE64_BYTES = Math.ceil(LOGO_MAX_BYTES / 3) * 4;
const brandSchema = z.object({
  accent: z.string().nullable(),
  hasCustomAccent: z.boolean(),
  logoUpdatedAt: z.iso.datetime().nullable(),
});
const successSchema = z.object({ success: z.literal(true) });
const logoMimeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

function brandUrl(shopId: string, suffix = "") {
  return internalApiUrl(`/v1/shops/${encodeURIComponent(shopId)}/brand${suffix}`, "API_BASE_URL is required to access shop branding");
}

async function requestBrand(shopId: string, suffix: string, options: RequestInit): Promise<Response> {
  return internalApiFetch(brandUrl(shopId, suffix), {
    ...options,
    headers: {
      ...options.headers,
    },
  });
}

async function throwApiError(response: Response): Promise<never> {
  let message = `Nest brand API returned ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const detail = body.message;
      if (typeof detail === "string") { message = detail; }
      else if (Array.isArray(detail) && detail.every((item) => typeof item === "string")) { message = detail.join(", "); }
    }
  } catch {
    // Keep the status error if the API has no JSON error body.
  }
  throw new Error(message);
}

async function assertSuccessResponse(response: Response) {
  if (!response.ok) { return throwApiError(response); }
  const parsed = successSchema.safeParse(await response.json());
  if (!parsed.success) { throw new Error("Nest brand API returned an invalid response"); }
}

export async function getBrand(shopId: string): Promise<ShopBrand> {
  const response = await requestBrand(shopId, "", { method: "GET" });
  if (!response.ok) { return throwApiError(response); }
  const parsed = brandSchema.safeParse(await response.json());
  if (!parsed.success) { throw new Error("Nest brand API returned an invalid payload"); }
  const logoUpdatedAt = parsed.data.logoUpdatedAt ? new Date(parsed.data.logoUpdatedAt) : null;
  return {
    accent: parsed.data.accent ?? DEFAULT_ACCENT,
    hasCustomAccent: parsed.data.hasCustomAccent,
    logoUrl: logoUpdatedAt ? brandLogoUrl(shopId, logoUpdatedAt) : null,
  };
}

export async function getLogo(shopId: string): Promise<{ bytes: Buffer; mime: string; updatedAt: Date } | null> {
  const response = await requestBrand(shopId, "/logo", { method: "GET" });
  if (response.status === 404) { return null; }
  if (!response.ok) { return throwApiError(response); }
  const mime = logoMimeSchema.safeParse(response.headers.get("content-type"));
  const updatedAtValue = response.headers.get("x-brand-updated-at");
  const updatedAt = updatedAtValue ? new Date(updatedAtValue) : null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!mime.success || !updatedAt || !Number.isFinite(updatedAt.getTime()) || bytes.byteLength === 0 ||
    bytes.byteLength > LOGO_MAX_BYTES || sniffImageMime(bytes) !== mime.data) {
    throw new Error("Nest brand API returned an invalid logo payload");
  }
  return { bytes, mime: mime.data, updatedAt };
}

/** null resets to the default accent. The API validates and normalises the value. */
export async function saveAccent(shopId: string, accent: string | null): Promise<void> {
  const normalized = accent === null ? null : normalizeHex(accent);
  if (accent !== null && !normalized) { throw new Error("รหัสสีไม่ถูกต้อง"); }
  const response = await requestBrand(shopId, "/accent", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accent: normalized }),
  });
  await assertSuccessResponse(response);
}

/** Accepts PNG / JPEG / WebP up to LOGO_MAX_BYTES; Nest rechecks size and sniffs bytes. */
export async function saveLogo(shopId: string, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength === 0) { throw new Error("กรุณาเลือกไฟล์โลโก้"); }
  if (bytes.byteLength > LOGO_MAX_BYTES) { throw new Error("ไฟล์โลโก้ใหญ่เกิน 300 KB"); }
  const encoded = Buffer.from(bytes).toString("base64");
  if (Buffer.byteLength(encoded, "ascii") > MAX_BASE64_BYTES) { throw new Error("ไฟล์โลโก้ใหญ่เกิน 300 KB"); }
  const response = await requestBrand(shopId, "/logo", {
    method: "PUT",
    headers: { "content-type": "text/plain; charset=us-ascii" },
    body: encoded,
  });
  await assertSuccessResponse(response);
}

export async function removeLogo(shopId: string): Promise<void> {
  const response = await requestBrand(shopId, "/logo", { method: "DELETE" });
  await assertSuccessResponse(response);
}
