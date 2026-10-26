# Brand kit contract

Per-shop accent colour + logo that flows into LIFF, stamps, receipts, POS header and the LINE rich menu.
With no shop-specific brand set, screens use the YELO Coffee defaults (amber accent `#F4B942`, YELO mascot, stock stamp images).

## Already provided — import, do not rewrite

- `@/lib/brand` (pure, client-safe): `DEFAULT_ACCENT`, `INK`, `WHITE`, `BRAND_PRESETS` (`{id,name,accent}[]`),
  `LOGO_MAX_BYTES` (300 KB), `LOGO_MIMES`, `normalizeHex(s) → "#RRGGBB" | null`, `contrastRatio(a,b)`,
  `onAccent(hex) → WHITE | INK`, `brandVars(accent) → { "--brand", "--brand-fg" }` (spread into `style`),
  `sniffImageMime(bytes)`, `brandLogoUrl(shopId, updatedAt)`.
- `@/server/brand` (server-only):
  - `getBrand(shopId) → { accent, hasCustomAccent, logoUrl: string | null }`
  - `getLogo(shopId) → { bytes: Buffer, mime, updatedAt } | null`
  - `saveAccent(shopId, hex | null)` (null = reset; throws Thai message on invalid)
  - `saveLogo(shopId, bytes: Uint8Array)` (throws Thai message on bad type / >300 KB)
  - `removeLogo(shopId)`
- `GET /api/brand/[shopId]/logo` — public, immutable-cached (URL carries `?v=`).
- `@/components/brand/brand`: `<BrandLogo logoUrl size className? alt? />`,
  `<BrandStamp filled logoUrl size className? alt? />` (needs `--brand` on an ancestor).
- Font for server images: `frontend/src/server/fonts/IBMPlexSansThai-Bold.ttf` (OFL).
- Table `shop_brands` (migration 0004, RLS on).

## Rules

- Every query scoped by `shopId` from the session; never trust a shopId from the client.
- Admin brand mutations: owner or manager only (`requireStaff()`; barista → refuse).
- Thai UI copy. No `console.*` (use `@/lib/logger`). Keep the existing GSAP motion and
  reduced-motion behaviour working. Touch targets ≥ 44px.
- Colours on top of the accent use `var(--brand-fg)`, never hard-coded white.
- YELO Coffee is the demo shop identity: espresso `#4A2C1A`, amber `#F4B942`, latte `#B88A5A`, cream `#F7F1E7`, ink `#2F2A25`.
- YELO Coffee is the product and demo identity. All surfaces use the YELO visual system by default; shops can still provide their own logo and accent.
- Next.js 16 here differs from older versions: read `frontend/node_modules/next/dist/docs/` before using
  an API you are unsure of (e.g. `next/og` ImageResponse, server actions, `connection()`).
