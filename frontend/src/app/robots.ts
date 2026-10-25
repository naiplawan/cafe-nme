import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const PRIVATE_PATHS = [
  "/admin",
  "/pos",
  "/liff",
  "/onboarding",
  "/select-shop",
  "/api",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// One rule for every crawler: AI answer engines (GPTBot, ClaudeBot, PerplexityBot, Google-Extended...)
// are allowed on purpose so they can cite the landing page. Don't add per-bot blocks without a reason.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
