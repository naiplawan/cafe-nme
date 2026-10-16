# Changelog

All notable changes to Cafe'nMe are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses semantic
versioning (pre-1.0: minor = features, patch = fixes).

## [Unreleased]

### Changed
- Production demo seeding now requires explicit confirmation and custom owner credentials, and skips when the demo shop or owner already exists.

### Fixed
- Entering a wrong POS PIN now shows "PIN ไม่ถูกต้อง" instead of crashing the sign-in page with a server error.
- Adding a walk-in member with a phone number that already exists now shows the API's message ("เบอร์โทรนี้มีสมาชิกแล้ว"), and looking up an unknown member token returns no member instead of crashing.
- Admin dashboard reports now compare the text-based business date column with text date bounds, preventing PostgreSQL type errors.
- POS pairing now handles invalid or expired codes without crashing, and production has the rate-limit table required by pairing requests.

### Added
- The admin menu is split into Categories, Products, and POS preview tabs that can be opened in any order; the product form shows every section on one page with jump links (Basics, Modifiers, Image, Sale), creates a category inline, and links to the new product after adding it.
- Categories and products can be reordered by dragging or with arrow buttons; the POS shows the saved order within each category and in the All view.
- A modifier group can be added to or removed from many selected products in one confirmed bulk action.
- Sold-out products can reopen automatically on the shop's next business day; the setting sits next to the sold-out controls and is on by default.
- Products without a photo show a coloured tile with their first letter on the POS and in admin; owners can pick the colour or leave it automatic.
- Admin menu filters are kept in the URL, so switching tabs and returning from a product's edit page keeps the current search, category, and status.
- Product creation now supports product images and modifier groups; selected products can be reopened for sale in one confirmed bulk action.
- Added a NestJS backend workspace with an internal API, generated OpenAPI documentation, and database readiness checks.

### Changed
- Database migrations `0007` (sold-out business date, auto-clear setting) and `0008` (product tile colour) must run before deploying the new API, which reads those columns.
- Simplified the admin menu layout: plain tabs, no duplicate headings, and the sold-out reset and bulk-action bar only appear when they apply; category filter chips no longer show item counts.
- Menu management now offers a one-click filter reset, clearer sale-visibility labels, and hides the sample-menu action after all examples are added.
- Split the application into separate `frontend/` (Next.js) and `backend/` (NestJS) workspaces.
- Configure the frontend and NestJS API as separate Vercel projects, using Vercel's assigned API port and a dedicated internal request secret while preserving the data-encryption secret.

### Fixed
- Prevent duplicate category names, ignoring letter case, from creating indistinguishable menu groups; preserve the no-category choice when saving a product.

### Security
- Restrict the LIFF development identity mock to development and normalize server errors without returning internal exception details.

## [0.1.0] - 2026-10-13

First release of the MVP on top of the Create Next App scaffold (`731772e`).

### Added
- **Data model and auth** — Drizzle schema with RLS-enabled tables and migrations 0000–0005
  (`backend/src/db/schema.ts`, `backend/drizzle/`); Supabase Auth sign-up/login and onboarding that creates the
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
