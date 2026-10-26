# YELO Coffee

A point of sale for Thai cafés with a LINE stamp-card membership. Staff sell on a tablet POS, owners manage the shop and see sales charts in a web admin, and customers collect stamps and redeem free drinks from a LINE Official Account (rich menu + LIFF member card).

https://github.com/user-attachments/assets/a1b59e8e-ab27-4552-9f1f-6abf433030d1

The product scope, decisions and architecture are in [PLAN.md](./PLAN.md).

The applications live in separate workspace packages:

```text
frontend/  Next.js app, browser assets, and frontend tests
backend/   NestJS API, PostgreSQL schema/migrations, and seed scripts
docs/      Product and engineering documentation
```

<p align="center"><img src="docs/screenshots/pos-sale.webp" alt="POS sales screen on a 1280×800 tablet" width="820"></p>

## Features

**POS (tablet, touch)**
- Pair a tablet with a 6-digit code or QR, staff sign in with a PIN.
- Photo menu with search and categories, in the order the owner sets; items without a photo get a coloured tile with their first letter. Add-ons (sweetness, hot/iced, milk, extra shot), editable cart lines that survive a refresh.
- Cash with smart quick amounts, or PromptPay QR with the amount built in.
- Scan a member's LINE QR or search by phone; stamps and free-drink rewards apply automatically.
- One-tap "sold out" toggle that can clear itself on the next business day, today's orders, voids with a manager PIN, 58 mm receipts, and a live daily summary.

**Admin (web)**
- Setup checklist for new shops, stock menu with 30 photos, standard add-on set, bulk linking of add-ons to products.
- Menu admin in three tabs (categories, products, POS preview) that open in any order: drag or arrow-key reordering of categories and products, a one-page product form with jump links, inline category creation, a colour picker for photo-less items, bulk show/hide/reopen and add/remove of add-on groups, and filters that survive a trip to the edit page.
- Dashboard and reports with animated charts (sales trend, hourly sales, categories, best sellers, payment mix, members), CSV export.
- Members, staff and roles, POS devices, LINE channel settings.
- Brand kit: shop logo and colour flow into the LINE member card, stamps, receipts and a generated LINE rich menu.

**LINE (customers)**
- Rich menu: member card, my stamps, menu, sign up, shop profile, contact.
- LIFF member card with a rotating QR, stamp progress and rewards; menu view; PDPA consent and self-service data deletion.

| Admin dashboard | Reports | Brand kit |
| --- | --- | --- |
| ![Admin dashboard](docs/screenshots/admin-dashboard.webp) | ![Reports](docs/screenshots/admin-reports.webp) | ![Brand kit](docs/screenshots/admin-brand.webp) |

| Add-ons | PromptPay | Daily summary |
| --- | --- | --- |
| ![Add-on sheet](docs/screenshots/pos-modifiers.webp) | ![PromptPay payment](docs/screenshots/pos-promptpay.webp) | ![POS daily summary](docs/screenshots/pos-summary.webp) |

| LINE member card | LINE menu |
| --- | --- |
| <img src="docs/screenshots/liff-card.webp" alt="LIFF member card" width="300"> | <img src="docs/screenshots/liff-menu.webp" alt="LIFF menu" width="300"> |

## Stack

Frontend: Next.js 16 (App Router, Cache Components) · React 19 · Tailwind CSS 4 · shadcn/ui (Base UI) · GSAP · Vitest. Backend: NestJS 12 · PostgreSQL · Drizzle ORM · LINE Messaging API + LIFF.

## Local setup

Prerequisites: Node.js 20.9+, pnpm, and PostgreSQL 18 (local or Railway).

1. `pnpm install`
2. Create a PostgreSQL database locally or use Railway's private `DATABASE_URL`.
3. Copy `frontend/.env.example` to `frontend/.env.local` and set `DATABASE_URL`, `APP_SECRET` (e.g. `openssl rand -hex 32`), and the shared `INTERNAL_API_SECRET`. Set the same database and secrets in `backend/.env`.
4. `pnpm db:migrate`
5. `pnpm db:seed`, then optionally `pnpm db:seed-menu` (30 photo menu items) and `pnpm db:seed-sales` (30 days of demo orders; `--reset` removes them).
6. `pnpm dev`
7. The local seed creates `owner@demo.test` / `password123`. POS PINs: owner `1234`, barista `1111`. With `LINE_DEV_MOCK=1` the LIFF pages work without LINE at `/liff/demo-cafe`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by the backend (server only). |
| `SEED_TARGET` / `SEED_CONFIRM_PRODUCTION` | Set to `production` / `demo-cafe` to explicitly allow a live demo seed. |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | Optional local demo credentials; custom credentials are required for a production seed. |
| `SEED_OWNER_PIN` / `SEED_BARISTA_PIN` | Production seed requires two different six-digit POS PINs. |
| `API_BASE_URL` / `API_PORT` | Frontend's backend URL and Nest's listening port. |
| `APP_SECRET` | Signs POS sessions and member QR tokens; derives the key that encrypts LINE secrets. |
| `FRONTEND_URL` | Backend recovery-link origin; HTTPS in production. |
| `RESEND_API_KEY` / `RECOVERY_EMAIL_FROM` | Backend-only recovery email API key and verified sender. |
| `LINE_DEV_MOCK` | `1` only in local development. |

LINE channel IDs, secret and access token are entered per shop in **Admin › เชื่อมต่อ LINE** and stored encrypted.

For a production seed, put the Railway PostgreSQL `DATABASE_URL` in the ignored `backend/.env.production.local`, then set `SEED_TARGET=production`, `SEED_CONFIRM_PRODUCTION=demo-cafe`, `SEED_OWNER_EMAIL`, a strong `SEED_OWNER_PASSWORD`, and different six-digit `SEED_OWNER_PIN` and `SEED_BARISTA_PIN` values when running `pnpm db:seed`. The script refuses the public demo password and skips existing demo data; rerunning it refreshes the two demo staff PINs without changing the owner password.

## Account recovery

The login page links to `/forgot-password`. Set `FRONTEND_URL`, `RESEND_API_KEY`, and
`RECOVERY_EMAIL_FROM` in the backend environment, then apply migrations through
`0022_password_recovery` before deploying the updated API. Delivery uses the
[Resend email API](https://resend.com/docs/api-reference/emails/send-email).
Without mail configuration, the request form reports that recovery is unavailable.

Reset links keep the token in a URL fragment, expire after 30 minutes, and can be
used once. Only token hashes are stored. A successful reset revokes the account's
admin sessions; staff PINs and paired devices remain separate. Requests are limited
per source IP and email, and return the same accepted response for known and unknown
accounts. Email delivery is asynchronous; provider failures are logged for operators.
Verify delivery with a controlled mailbox after configuring the deployment.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` / `build` / `start` | Develop, build and run the app. |
| `pnpm typecheck` / `lint` | TypeScript checks for both apps and workspace lint. |
| `pnpm api:generate` / `api:check` | Regenerate Nest OpenAPI and frontend TypeScript types; CI checks for stale generated contracts. |
| `pnpm test` / `test:int` | Unit tests / integration tests against the database. |
| `pnpm test:e2e` | Real browser sale-to-shift-close and lost-response recovery checks; requires an isolated local database. See [POS acceptance](docs/pos-acceptance.md). |
| `TEST_DATABASE_URL=… pnpm --filter @cafenme/backend test:db` | Migrate a disposable PostgreSQL database, then run the API tests against it. Without the migration, database tests fail and leave connections open. |
| `pnpm db:generate` / `db:migrate` | Generate and apply Drizzle migrations. |
| `pnpm db:seed` / `db:seed-menu` / `db:seed-sales` | Demo shop, stock menu, demo sales. |
