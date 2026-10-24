import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import type { CartLineInput } from "@/lib/pricing";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";
const summarySchema = z.object({ totalSatang: z.number().int().nonnegative(), itemCount: z.number().int().positive(), method: z.enum(["cash", "promptpay"]) });
export type TrialSummary = z.infer<typeof summarySchema>;
export async function runTrialCheckout(shopId: string, actorStaffId: string, lines: CartLineInput[], method: "cash" | "promptpay"): Promise<TrialSummary> {
  const response = await internalApiFetch(`/v1/shops/${shopId}/setup/trial-checkout`, { method: "POST", body: JSON.stringify({ actorStaffId, lines, method }) });
  if (!response.ok) { throw new Error("Trial checkout failed"); }
  return summarySchema.parse(await readInternalJson(response));
}
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i;
export function publicMenuUrl(slug: string, origin: string): string {
  const parsed = new URL(origin);
  if (!SLUG.test(slug) || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Invalid public menu origin or shop slug");
  }
  return new URL(`/menu/${encodeURIComponent(slug)}`, parsed.origin).href;
}
export async function publicMenuQr(slug: string) {
  const origin = process.env.FRONTEND_URL;
  if (!origin) { return null; }
  const url = publicMenuUrl(slug, origin);
  return { url, image: await QRCode.toDataURL(url, { width: 384, margin: 2, errorCorrectionLevel: "M" }) };
}
