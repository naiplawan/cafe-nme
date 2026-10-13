# Changelog

All notable changes to Cafe'nMe are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses semantic
versioning (pre-1.0: minor = features, patch = fixes).

## [0.1.0] - 2026-10-13

First release of the MVP on top of the Create Next App scaffold (`731772e`).

### Added
- **Data model and auth** — Drizzle schema with RLS-enabled tables and migrations 0000–0005
  (`src/db/schema.ts`, `drizzle/`); Supabase Auth sign-up/login and onboarding that creates the
  shop, the owner and the owner's POS PIN (`src/app/(auth)`, `src/app/onboarding`, `src/server/auth-actions.ts`).
- **POS (tablet)** — device pairing by code or QR (`/pos/pair?code=`), staff PIN login, photo menu
  with search, add-ons with editable cart lines, cart persisted across refresh, cash with smart
  quick amounts, PromptPay QR, member lookup by LINE QR or phone, stamps and free-drink rewards,
  sold-out toggle with a checkout guard, today's orders with manager-PIN voids, 58 mm receipts and a
  daily summary (`src/app/pos`, `src/server/orders.ts`, `src/server/pos-session.ts`, `src/lib/pricing.ts`, `src/lib/cart-storage.ts`).
- **Admin** — setup checklist, menu with stock import of 30 photo items, add-on groups with a
  standard set and bulk product linking, staff, devices with pairing QR, members, LINE settings,
  confirm dialogs (`src/app/admin`, `src/server/menu.ts`, `src/server/modifiers.ts`, `src/components/ui/confirm-dialog.tsx`).
- **Reports and charts** — GSAP-animated SVG chart kit (area, bar, donut, ranked bars, count-up)
  on the dashboard, reports, members and POS summary; hourly, category and member-growth queries;
  CSV export (`src/components/charts`, `src/server/reports.ts`).
- **Brand kit** — per-shop logo and accent colour applied to the LIFF card, stamps, receipts, POS
  and a generated LINE rich menu (`src/server/brand.ts`, `src/server/rich-menu-image.tsx`, `/admin/brand`).
- **LINE** — webhook with signature validation and keyword replies, rich menu wired to LIFF views
  (card, stamps, menu, register), LIFF member app with rotating QR, PDPA consent and data deletion
  (`src/app/api/line`, `src/server/line.ts`, `src/app/liff`).
- **Scripts and assets** — demo seeds (`db:seed`, `db:seed-menu`, `db:seed-sales --reset`),
  Codex-generated product photos and illustrations (`public/assets`), branding concepts and
  screenshots (`docs/branding`, `docs/screenshots`).
- Unit tests (108) and database integration tests (20) with Vitest.

### Changed
- App renamed to **Cafe'nMe** (page titles, logos, demo shop, docs).
- README rewritten with features, screenshots, setup and environment variables.

### Removed
- Default `src/app/favicon.ico` (replaced by `src/app/icon.png`).

### Security
- LINE channel secret and access token are stored AES-256-GCM encrypted; POS sessions and member
  QR tokens are HMAC-signed; every server query is scoped by the session's shop.
