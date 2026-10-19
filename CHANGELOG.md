# Changelog

All notable changes to Cafe'nMe are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses semantic
versioning (pre-1.0: minor = features, patch = fixes).

## [Unreleased]

### Added
- Frontend server adapters share one internal API transport for URL construction, authentication, JSON headers, and uncached requests.
- Database constraints enforce valid stamp goals, product and order prices, modifier selection bounds, and order quantities; migration `0020_business_invariants` applies them.
- Isolated checkout pricing and reward calculations into a domain module with focused unit coverage.

### Changed
- Order read queries now live in a dedicated service, separate from checkout and order mutations.
- API failures log request context and stack frames while keeping exception messages out of logs and client responses.
- Architecture documentation now describes the Next.js-to-NestJS API boundary and identifies the original module contracts as historical.

### Operations
- Apply migration `0020_business_invariants` before deploying the updated API.

### Added
- Owner dashboards compare recent sales and order counts across branches the owner manages.
- Login and signup pages explain Cafe'nMe's multi-branch features on desktop while keeping a compact mobile layout.

### Changed
- Login and signup inputs now provide clearer placeholders, accessible field errors, and focus on the first invalid field.
- Menu images stream from Railway Object Storage through the frontend route so Next.js image optimization can read them.

### Security
- Login and signup throttles use the validated client address instead of a target email, preventing unauthenticated callers from locking a specific address out of either flow.
- POS pairing codes now contain eight digits, and pairing throttles accept only the trusted `x-real-ip` address.
- LINE webhook request bodies are streamed with a 1 MiB limit before shop configuration is fetched.

### Operations
- Create the `cafenme-menu-assets` bucket in Singapore and configure its four reference variables on the frontend; migration `0017_railway_menu_assets` updates saved product image paths.
- Apply migration `0019_remove_email_verification` to drop verification tokens and state. Production frontend ingress must overwrite `x-real-ip`.
- Apply migration `0018_multi_branch_memberships` before deploying multi-branch admin; it lets an account link to one staff membership per shop.

### Added
- Menu catalog and legacy product photos now use Railway's private storage bucket through signed asset links.
- Business owners can create branches, choose a branch after login, and switch branches from a compact admin control; branch-specific POS setup and isolated data are explained during creation.
- Added the multi-branch design and rollout plan in `docs/multi-branch-admin-plan.md`.
- Loading states for admin brand, members, modifiers, and staff pages.

### Changed
- Refined the brand and modifier admin forms and POS cart interactions for clearer workflows.
- Signup now creates a session immediately without requiring outbound email.
- The menu-asset route and authenticated setup/branch-selection pages now build with Next.js 16 Cache Components and stream loading shells while checking the session.

### Breaking changes
- Email ownership verification is removed. Signup no longer verifies mailbox ownership; password recovery remains operator-managed.

### Removed
- Removed Resend delivery, email verification tokens, and the email verification route; email addresses remain account identifiers and login credentials.
- Removed the obsolete Supabase agent skill files.

### Operations
- Migration `0019_remove_email_verification` removes the email-verification state restored by migration `0016_restore_email_verification`.

### Added
- Owners can preview a one-baht QR from their saved PromptPay identifier to inspect the recipient in a banking app without making a transfer.
- Checkout accepts an optional UUID request key and stores the original receipt atomically; identical retries return that receipt without repeating payment or loyalty writes.
- The POS preserves unresolved payments across reloads and recovers the original request before allowing another sale; failed browser storage blocks submission before it reaches the API.
- CI now applies migrations to disposable PostgreSQL and runs backend and frontend integration tests alongside the existing quality checks.

### Fixed
- Pending checkout stays tied to the original shop, staff, and device when another tab changes the login; reload and conflict recovery retain the original sale key.
- Nest rejects new PromptPay sales when the shop has no receiving identifier, including configuration changes concurrent with checkout.
- Modifier group editing preserves selection minimums greater than one, and failed modifier submissions retain entered values.
- Staff PIN changes show explicit success or failure feedback and explain why owner and current-user accounts cannot be deactivated.
- Menu creation links preserve their URL state; product edit links identify the product for assistive technology.
- Member searches distinguish filtered empty results from first-time setup; available rewards show their earned dates and POS redemption guidance.
- Invalid report date ranges display a correction message instead of silently showing today's sales; report loading and retry states are explicit.

### Operations
- API readiness now checks the deployed migration head and SQL hash. Apply migration `0012_checkout_idempotency` before starting the new API; configure Railway's API pre-deploy migration command and `/health/ready` healthcheck as described in `docs/railway-release.md`.

### Breaking changes
- Admin authentication now uses Railway PostgreSQL accounts and sessions instead of Supabase Auth. Apply migrations `0009` and `0010`, configure `API_BASE_URL`, `APP_SECRET`, and the shared `INTERNAL_API_SECRET`; existing Supabase Auth users are not migrated and must be recreated or seeded.

### Added
- PostgreSQL-backed admin accounts with scrypt password hashes, hashed revocable session tokens, and HttpOnly session cookies.
- Production demo seeding now requires distinct six-digit owner and barista POS PINs; rerunning the seed refreshes these PINs without changing the existing owner password.
- Owners can set, replace, or disable a shop's PromptPay ID in admin payment settings; the saved ID is masked in the UI and protected by owner checks in Next.js and NestJS.
- The POS PromptPay option remains disabled until an owner configures a receiving ID; setup guidance reminds owners to register it with their bank and check the recipient name before accepting payments.

### Removed
- Supabase client dependencies, local Supabase configuration, and the Supabase CLI workspace command.

### Security
- Login and signup attempts are rate-limited; passwords and session tokens are stored as hashes.

### Changed
- New demo shops start with PromptPay disabled. Run `pnpm --filter @cafenme/backend db:migrate` to apply migration `0011_clear_demo_promptpay`, which clears only the seeded `demo-cafe` placeholder.
- The README now plays the 24-second product film inline on GitHub.
- Production demo seeding now requires explicit confirmation and custom owner credentials, and skips when the demo shop or owner already exists.

### Fixed
- Entering a wrong POS PIN now shows "PIN ไม่ถูกต้อง" instead of crashing the sign-in page with a server error.
- Adding a walk-in member with a phone number that already exists now shows the API's message ("เบอร์โทรนี้มีสมาชิกแล้ว"), and looking up an unknown member token returns no member instead of crashing.
- Admin dashboard reports now compare the text-based business date column with text date bounds, preventing PostgreSQL type errors.
- POS pairing now handles invalid or expired codes without crashing, and production has the rate-limit table required by pairing requests.
- Voiding an order now blocks while its earned reward is still redeemed and reverses the stamp ledger deltas recorded for that order.
- Checkout now reopens products whose sold-out mark expired on an earlier business day (when auto-reopen is on), so a POS that has not reloaded the menu can still sell them instead of getting a sold-out rejection.

### Added
- The admin menu is split into Categories, Products, and POS preview tabs that can be opened in any order; the product form shows every section on one page with jump links (Basics, Modifiers, Image, Sale), creates a category inline, and links to the new product after adding it.
- Categories and products can be reordered by dragging or with arrow buttons; the POS shows the saved order within each category and in the All view.
- A modifier group can be added to or removed from many selected products in one confirmed bulk action.
- Sold-out products can reopen automatically on the shop's next business day; the setting sits next to the sold-out controls and is on by default.
- Products without a photo show a coloured tile with their first letter on the POS and in admin; owners can pick the colour or leave it automatic.
- A 24-second product film (`docs/media/cafenme-film.mp4`) is linked from the README.
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
