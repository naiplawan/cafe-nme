import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { LANDING_UPDATED } from "./landing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: LANDING_UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/contact`, lastModified: LANDING_UPDATED, changeFrequency: "yearly", priority: 0.5 },
  ];
}
