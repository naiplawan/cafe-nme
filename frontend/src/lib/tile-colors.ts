/** Colours for product tiles without a photo. Keep in sync with TILE_COLORS in backend/src/menu.service.ts. */
export const TILE_COLORS = ["amber", "rose", "emerald", "sky", "violet", "stone"] as const;
export type TileColor = (typeof TILE_COLORS)[number];

export const TILE_COLOR_LABELS: Record<TileColor, string> = {
  amber: "เหลือง",
  rose: "ชมพู",
  emerald: "เขียว",
  sky: "ฟ้า",
  violet: "ม่วง",
  stone: "เทา",
};

// Full class strings so Tailwind can see them.
const TILE_CLASSES: Record<TileColor, string> = {
  amber: "bg-amber-200 text-amber-900",
  rose: "bg-rose-200 text-rose-900",
  emerald: "bg-emerald-200 text-emerald-900",
  sky: "bg-sky-200 text-sky-900",
  violet: "bg-violet-200 text-violet-900",
  stone: "bg-stone-300 text-stone-800",
};

export function isTileColor(value: unknown): value is TileColor {
  return typeof value === "string" && (TILE_COLORS as readonly string[]).includes(value);
}

/** The chosen colour, or a stable one picked from the name so photo-less tiles still differ. */
export function tileColorOf(product: { name: string; tileColor?: string | null }): TileColor {
  if (isTileColor(product.tileColor)) return product.tileColor;
  let hash = 0;
  for (const char of product.name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export function tileClasses(color: TileColor) {
  return TILE_CLASSES[color];
}
