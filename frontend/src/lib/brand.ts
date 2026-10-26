// Shop brand kit: accent colour + logo. Pure helpers shared by server and client.

export const DEFAULT_ACCENT = "#F4B942";
export const INK = "#2F2A25";
export const WHITE = "#FFFFFF";

export const BRAND_PRESETS = [
  { id: "yelo", name: "YELO Coffee", accent: "#F4B942" },
  { id: "terracotta", name: "เทอร์ราคอตต้า", accent: "#B4441C" },
  { id: "tomato", name: "แดงมะเขือเทศ", accent: "#D23A26" },
  { id: "matcha", name: "เขียวมัทฉะ", accent: "#5E7A3A" },
  { id: "cocoa", name: "โกโก้", accent: "#6B4226" },
  { id: "ocean", name: "น้ำเงินทะเล", accent: "#1F5F8B" },
  { id: "ink", name: "ดำหมึก", accent: "#2B2B28" },
] as const;

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIMES)[number];

/** "#abc" / "abc" / "#AABBCC" → "#AABBCC"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${[...raw].map((c) => c + c).join("")}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a 6-digit hex colour. */
export function relativeLuminance(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Invalid colour: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour to put on top of the accent: whichever of white / ink reads better. */
export function onAccent(accent: string): typeof WHITE | typeof INK {
  return contrastRatio(accent, WHITE) >= contrastRatio(accent, INK) ? WHITE : INK;
}

/** CSS custom properties for a brand root element: --brand and --brand-fg. */
export function brandVars(accent: string | null | undefined): Record<"--brand" | "--brand-fg", string> {
  const hex = (accent && normalizeHex(accent)) || DEFAULT_ACCENT;
  return { "--brand": hex, "--brand-fg": onAccent(hex) };
}

/** Detect PNG / JPEG / WebP from magic bytes; never trust the client's content type. */
export function sniffImageMime(bytes: Uint8Array): LogoMime | null {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Public, cache-busted URL for a shop's logo. */
export function brandLogoUrl(shopId: string, updatedAt: Date): string {
  return `/api/brand/${shopId}/logo?v=${updatedAt.getTime()}`;
}
