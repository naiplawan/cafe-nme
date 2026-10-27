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

## Design system v2 (public pages)

Applies to `/`, `/contact` and the login/signup showcase panel. POS, admin, LIFF and `/menu/[shopSlug]` keep the shadcn
`:root` values and the per-shop `--brand` accent.

- **Tokens** live in `frontend/src/app/globals.css` under `@theme`: `espresso #4A2C1A`, `roast #6B4226`, `caramel #8B4F28`,
  `latte #B88A5A` (decoration only), `amber #F4B942`, `butter #FBE7B5`, `blush #F6A6C8`, `cream #F7F1E7`, `ink #2F2A25`,
  `muted-ink #6B5E55`, `line #E5D8C5`, plus status colours `leaf #2E7D32` (✓ in the comparison table) and `danger #B3261E`
  (form errors). Radii `rounded-section` 40px and `rounded-card` 24px; one shadow, `shadow-soft`. Pages use the token
  classes, never raw hex (the decorative PosMock on the landing page is the only exception).
- **Text on colour:** cream/butter text only on espresso, roast or caramel; ink/espresso text on amber, butter or blush.
  Amber stays the only primary button colour. Blush is for marquee bands and small stickers, never a button or body text.
- **Wordmark:** "YELO COFFEE" is live text in the condensed display face (`Wordmark` in `components/site/wordmark.tsx`)
  next to the unchanged mascot image. Lilita One and Mitr are no longer used.
- **Display face:** Noto Sans Thai with its `wdth` axis (`font-display-condensed`, width 75; the wordmark uses 70), loaded in
  `components/site/display-font.ts` so only pages that use it download the wider file. Thai display lines keep
  `line-height` ≥ 1.2 so tone marks are not clipped, and Thai text gets no letter-spacing.
- **Components** (`frontend/src/components/site/`): `PillLink`/`PillButton` (label + arrow circle, min height 48px),
  `TiltLabel`/`Sticker`, `SectionCard` (caramel, espresso, butter, cream, blush), `Marquee` (GSAP loop, static under
  reduced motion), `SiteHeader`, `SiteFooter`, `Field`, `Wordmark`; `bg-checker` and `bg-checker-amber` utilities.
- **Contact page:** `/contact` posts through a server action to `POST /v1/contact-messages` (see `docs/CONTRACTS.md`). It
  shows the form only; add real contact details (LINE OA, email, phone, address) only when the owner supplies them.
