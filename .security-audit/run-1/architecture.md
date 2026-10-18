# Architecture and Audit Scope

## Application and baseline

This repository is a multi-tenant cafe point-of-sale application. The monorepo contains a Next.js 16.4 / React 19 frontend (`frontend/`) and a NestJS 12 API (`backend/`), with PostgreSQL persistence through `postgres` and Drizzle migrations. The frontend serves public shop/LINE LIFF experiences, staff POS pages, and authenticated shop administration. The API binds to `0.0.0.0`; every `/v1` controller is guarded by a shared internal HMAC-derived API token. Browser CORS is disabled. Production deployment configuration and network policy were not independently inspected.

The comparison baseline is a small cloud-hosted, multi-tenant POS such as Square for Restaurants or Toast: shop records and staff identities are separate trust scopes; checkout prices/rewards are recomputed server-side; manager/owner controls gate sensitive operations; customer self-service identity must come from the external identity provider. This is used as an application-class baseline, not as a claim about the internals of a named vendor.

## Trust model and critical assets

- **Public visitors / LINE members:** can use the shop's LIFF routes and public logo; member operations require a LINE ID token verified against that shop's login channel.
- **Application users:** authenticate with email/password, receive an opaque 30-day session token in an HttpOnly, SameSite=Lax cookie, and map to one active staff row for one shop. Admin Server Actions call `requireStaff()` and scope data through that session's `shopId`.
- **POS devices and staff:** a one-time six-digit pairing code provisions a random device token stored as a hash by the API and as an HttpOnly cookie by the frontend. Staff authenticate with a 4–6 digit PIN; a signed staff cookie is bound to the device and checked against active staff state.
- **Frontend-to-API service boundary:** the frontend computes `x-internal-api-token` from `INTERNAL_API_SECRET` (or `APP_SECRET` fallback); the API checks it with timing-safe comparison. The credential is not intended for browsers.
- **Critical assets:** user session credentials, staff PIN hashes and POS device tokens, shop-scoped sales/member/order data, PromptPay destination identifiers, loyalty balances/rewards, and encrypted LINE channel credentials.

## Input surfaces and high-risk flows

- Web forms and Next.js Server Actions: auth (`frontend/src/server/auth-actions.ts`), shop setup, staff/device administration, menus, modifiers, orders, payment settings, reports/export, and POS operations. These must enforce authentication and role checks at the action boundary.
- Public LIFF Server Actions accept a shop slug, LINE ID token, registration fields, or data deletion request (`frontend/src/app/liff/[shopSlug]/actions.ts`); `backend/src/liff.service.ts` verifies LINE identity and scopes queries by shop slug and LINE subject.
- Public LINE webhook route (`frontend/src/app/api/line/webhook/[shopId]/route.ts`) reads a raw request body, validates the LINE signature, parses events, and may call LINE Messaging API.
- Public POS pairing action accepts a six-digit code and consumes a rate limit keyed from request forwarding headers (`frontend/src/app/pos/pair/actions.ts`). Staff PIN login and manager-PIN checks are rate-limited per device.
- Admin logo upload passes bytes from a browser form through the frontend to a bounded base64 API endpoint; Nest validates size, canonical base64, and image magic bytes. Public logo reads are intentional.
- Checkout accepts product, modifier, quantity, member, reward, and payment inputs. `backend/src/orders.service.ts` fetches current shop menu data, verifies shop ownership and reward eligibility, computes prices, and records checkout state transactionally with idempotency locks.
- PostgreSQL is the principal state sink. SQL is parameterized via tagged template calls; dynamic shell execution and user-controlled code loading were not found in the reviewed request paths.

## Scope, assumptions, and exclusions

- Audit depth: **standard**.
- Reviewed: application source and migrations for authentication, authorization, session/device/PIN flows, checkout and rewards, member/LINE handling, uploads, exports, configuration, and representative dependency/workflow controls; automated SAST, dependency, and secret scans were also run.
- Source-driven only: no requests were sent to the deployed application, no production database or cloud account was accessed, and no live-secret verification was performed.
- `.env`/credential file contents were not manually read. Credential-like local files were identified by filename only. The automated Trivy scan was first run with insufficient nested-path exclusions and reported masked JWT-like detections in ignored local environment files and generated `.next` bundles; it was rerun with explicit path exclusions. See `automated-scan.md` for the corrected scan summary and limitation.
- Deployment ingress/proxy behavior (including whether forwarded client IP headers are overwritten), production secret rotation, database role grants, and hosting-level isolation were not available for verification. Generated `.next` bundles and `node_modules` were excluded from source review.
- No prior audit runs or accepted-risk baseline were present at setup. Additional runs with different path focus can improve coverage.
