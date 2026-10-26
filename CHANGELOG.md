# Changelog

All notable changes to Cafe'nMe are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses semantic
versioning (pre-1.0: minor = features, patch = fixes).

## [Unreleased]

### Added
- Add cash statements for active and closed shifts, with sales, actual refund payouts, drawer movements, staff/approval details, paginated entries, and reconciliation against the frozen closing balance.
- Record manager-approved drawer top-ups, petty cash and deposits with reasons and idempotent requests; include them in closing cash reconciliation.
- Support ingredient-replacement modifiers, immutable per-item recipes, opt-in stock consumption at preparation, pre-preparation reservation release, and recorded remakes without additional revenue.
- Track weighted-average purchase costs, audited opening stock valuation and immutable sale costs; report ingredient margins with missing-cost coverage, pending preparation, and separate remake/waste costs.
- Added a shop setup checklist for menu, POS, PromptPay, LINE, and a trial sale, plus a public QR menu that shows current prices and sold-out items without login.
- Added cash reconciliation by payment method, payment review history, provider charge verification, and Omise PromptPay support for accepted QR orders. Staff-recorded PromptPay remains distinct from provider-confirmed payment.
- Added shift opening and closing with opening float, expected and counted cash, variance, and handoff staff; added a preparation queue with order numbers, item notes, and received, preparing, and ready states.
- Added ingredient recipes and stock movements, self-service QR order requests with staff acceptance, partial refunds with approval and separately recorded payouts, subscription trials and payment history, and explicitly grouped cross-branch loyalty.
- Added configurable stamp and reward expiry with ledger history, plus checkout/API failure alerts and a repeatable isolated PostgreSQL restore drill.
- Added a public Thai landing page at `/` with features, setup steps, comparison, FAQ, and matching JSON-LD, plus `robots.txt`, `sitemap.xml`, `llms.txt`, and a generated Open Graph image. Signed-in users are still sent to `/admin`; app screens stay `noindex` and out of the sitemap.
- Reserve recipe ingredients for 30 minutes when staff open a PromptPay QR, refreshed while the QR stays open. Other sales cannot consume reserved stock, and the QR is withheld when stock cannot be reserved.

### Changed
- Rebrand the product from Cafe'nMe to YELO Coffee: deep coffee, golden amber, latte and cream palette across admin, POS, LIFF, receipts and charts; the golden-retriever mascot replaces the old logo mark; shops without their own accent now default to amber `#F4B942` instead of terracotta `#B4441C`. Amber is used only behind dark text; text links and labels use deep coffee `#4A2C1A` for contrast. New demo seeds create `YELO COFFEE` with the amber preset; existing shops keep their name.
- Finish the YELO rebrand: muted text darkens from `#817668` (3.6–4.4:1) to `#6B5E55` (5.1–6.3:1) on every app background; the filled stamp, category-rail marker, add-on ticks and scan line switch from the old orange to amber; the fifth chart colour matches `--chart-5`; POS, POS login and receipts use each shop's own logo again instead of special-casing a shop named "YELO COFFEE"; the vertical category rail no longer shows a 1px horizontal scrollbar; brand PNGs shrink from about 0.9 MB to 0.2–0.3 MB; README and landing screenshots are retaken in the new brand.
- Redesign the landing page in the YELO brand-kit style: Lilita One wordmark with Mitr Thai headings, a brand-style POS mock, five mascot illustrations, retaken product screenshots, and GSAP motion (hero sequence, line-drawn tagline underline, floating mascots, scroll reveals) that is disabled under reduced motion.
- Reject paid-order voids with `409 use_refund`; reverse paid sales through refund approval and separately confirmed payout. Only unpaid open bills can be cancelled without moving money.
- Apply loyalty rewards to the cheapest eligible base price while retaining add-on charges; free reward units and zero-price drinks earn no stamps. Refund reward units first without reversing unearned stamps.
- Tightened staff role changes so managers cannot create owners or change higher-privilege PINs; expanded shop scoping across member, POS, order, and report operations.
- Recover unresolved checkouts after reload using the original sale request and prevent duplicate order/payment creation on retries.
- Update the preparation queue every five seconds while online and visible, including immediately after reconnecting or returning to the tab.
- Require an open cash shift before a cash sale, and reject recipe consumption, waste, or stock adjustments that would make tracked ingredient balances negative. Stock receiving remains available to owners and managers after Pro expires so they can replenish ingredients and continue core POS sales.
- Block recipe edits while a PromptPay stock reservation is active and explain the wait in the inventory admin; waste and adjustments now count reserved stock as unavailable.
- Let search engines index public QR menus at `/menu/[shopSlug]`; their order pages stay `noindex`.
- Release a PromptPay stock reservation as soon as staff close the payment dialog or switch to cash, instead of holding stock and blocking recipe edits until the 30-minute expiry. Only the staff member who reserved can release it (`POST /v1/shops/{shopId}/orders/release-promptpay-stock/{requestId}`).
- Redirect visitors with a session cookie from `/` to `/admin` in `proxy.ts`, so signed-in users no longer see the landing page flash and `/` is fully static for everyone else.
- Extend the API schema and OpenAPI client types for payment review, shifts, preparation, expiry, self-orders, inventory, refunds, shared loyalty, subscriptions, and provider payment intents.
- Show a banner on the POS sale screen when no cash shift is open, with a link to open one; PromptPay sales stay available.
- Refresh QR order requests every five seconds while online and visible, and ask for confirmation before rejecting a request.
- Restyle the QR-order checkout with line totals, modifiers and the order total; give queue statuses distinct colours.
- Enter shift and drawer amounts on the on-screen keypad instead of the tablet keyboard; drawer movements sit in a collapsible section so the shift page shows one keypad.
- Add icons to the POS header shortcuts so they fit on one row, a bottom cart bar with item count and total on narrow screens, a five-second undo after removing a cart line, and a note when search covers all categories.
- Disable Pay while the cart contains a sold-out item.

### Operations
- Apply migrations `0032`–`0038` before deploying the business-rule updates. Existing shops keep payment-time stock consumption until they opt into preparation tracking. Historical costs and closed cash balances are not backfilled; see `docs/pos-business-rules.md` for policies and setup.
- Extend browser coverage to replacement recipes, cancellation before preparation, remakes and drawer movements; regenerate API contracts for inventory valuation, stock policy and margin reporting.
- Add `pnpm test:e2e` and CI browser coverage for device pairing, cash sales with modifiers, receipts, preparation, partial refunds, shift reconciliation, offline checkout blocking, and recovery after a committed checkout response is lost. Tests use an isolated local database and retain failure traces; see `docs/pos-acceptance.md` for setup and remaining shop pilot checks.
- Limit frontend test workers to two and allow 15 seconds per test to reduce module-import timeouts under resource contention, without enabling retries.
- Apply migrations `0023_payment_reviews` through `0031_promptpay_stock_holds` before deploying the updated API. `0031` only adds the `promptpay_stock_holds` and `promptpay_stock_hold_items` tables.
- Follow `docs/omise-payments.md` to configure per-shop Omise credentials and webhooks. Live charging remains disabled unless `OMISE_LIVE_ENABLED=true` is explicitly configured.
- Run API tests with `TEST_DATABASE_URL=… pnpm --filter @cafenme/backend test:db`, which migrates the disposable database first. The refund and Omise reconciliation tests now query the current Bangkok business date instead of a fixed day, so they no longer fail after 2026-10-24.
- Set `NEXT_PUBLIC_SITE_URL` to the public frontend origin before deploying the landing page; without it, canonical URLs, the sitemap, `robots.txt`, and JSON-LD point to `http://localhost:3000`.
- Follow `docs/operations-readiness.md` for the isolated restore drill and operator alert receiver. Local restore evidence does not establish production retention, alert delivery, or recovery objectives.

### Security
- Override vulnerable transitive `body-parser`, `multer`, and `fast-uri` versions with patched releases required by current advisories.
- Upgrade Next.js to 16.4.1 to address the reported App Router denial-of-service advisory.

### Fixed
- Give each shop a unique setup trial jump target without calling a React hook inside an async server page.
- Bind PromptPay save, clear, and preview actions to the branch displayed by the form so stale tabs cannot change another branch's settings.
- Preserve loyalty rewards when an order has no eligible item or would receive no discount.
- Handle empty HTTP 200 responses from nullable API lookups as missing records instead of JSON parse errors.
- Keep required modifier groups visible in the POS and block items whose required options are not configured.
- Authorize rich-menu previews against the requested branch membership, including branches outside the active admin cookie path.
- Stop the preparation queue's background refresh from disabling its buttons and dropping taps every five seconds.
- Show PromptPay reservation errors once instead of twice, and keep POS notices from overlapping each other, the header, or the Pay button.
- Format QR-order and provider-payment amounts with the shared baht formatter.

### Added
- Password recovery from the login page, with single-use links, request throttling, and admin session revocation after a reset.
- Checkout now fetches current server prices before payment and asks staff to accept a changed total.

### Fixed
- Mobile POS screens, payment, modifiers, and member lookup now fit narrow viewports; cash entry preserves fractional baht and payment tabs respect reduced motion.
- Cart contents survive logout; oversized carts and failed PIN, member lookup, menu edit, and order-detail requests show actionable feedback.
- Order selection ignores stale responses, void controls recover from failed requests, and expired member QR codes offer a retry instead of remaining visible.
- LINE delivery failures no longer report receipt success, and the member menu displays sold-out products correctly.

### Changed
- Menu input validation, availability, and stock import now have dedicated modules.
- Checkout batches order-line, modifier, and loyalty writes; persisted line numbers preserve receipt ordering.

### Operations
- Apply migrations through `0022_password_recovery` in the API pre-deploy step, including `0021_order_item_line_no`, before deploying the frontend.
- Configure backend `FRONTEND_URL`, `RESEND_API_KEY`, and `RECOVERY_EMAIL_FROM` to enable recovery email; signup remains independent of email delivery.

### Added
- Frontend server adapters share one internal API transport for URL construction, authentication, JSON headers, and uncached requests.
- Database constraints enforce valid stamp goals, product and order prices, modifier selection bounds, and order quantities; migration `0020_business_invariants` applies them.
- Isolated checkout pricing and reward calculations into a domain module with focused unit coverage.
- Generated frontend TypeScript API types from the Nest OpenAPI document and added a CI freshness check for both generated artifacts.

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
- Email ownership verification is removed. Signup no longer verifies mailbox ownership; the new recovery flow requires the mail configuration described above.

### Removed
- Removed signup verification delivery, email verification tokens, and the email verification route; email addresses remain account identifiers and login credentials.
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
