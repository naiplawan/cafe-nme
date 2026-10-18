# Security Audit Report

## Summary

This standard-depth source audit confirmed two authentication issues: an unauthenticated visitor can temporarily lock a known email address out of sign-in, and public signup lets a visitor claim an unregistered email and create an owner shop under it without proving ownership. The second issue can block the rightful holder from registering and permit storefront impersonation; the evidence does not show takeover of an existing account or access to existing data. Core tenant scoping, internal API guarding, password/token storage, checkout pricing, and LINE identity/signature checks were generally well enforced in the reviewed paths. Deployment-level controls remain outside this source review.

## Scope and method

- **Audit depth:** standard.
- **Scope:** the Next.js frontend, NestJS API, database schema/migrations, authentication and POS sessions, shop/staff role checks, checkout/rewards/member flows, reporting/export, LINE/LIFF routes, uploads, runtime configuration, and CI/dependency controls.
- **Exclusions:** no live deployment or production database access, no live-secret verification, and no runtime exploit requests. `.env` and credential contents were not manually read. Hosting ingress/proxy rules, WAF limits, and database grants were not available.
- **Automated tools:** Semgrep, Trivy, TruffleHog Git history scan, osv-scanner, and pnpm audit. Results and scan limitations are in `automated-scan.md`.
- **Prior runs:** none found; no `.security-audit/accepted.json` baseline was present. Later runs can improve coverage and reconcile these stable finding IDs.

## Baseline

The application was compared with the expectations for a small cloud-hosted, multi-tenant cafe POS such as Square for Restaurants or Toast: customer identity should be established by the configured identity provider; shop and staff operations should remain tenant-scoped; sensitive role checks should be enforced server-side; and checkout prices and rewards should be computed from trusted server data. This is an application-class baseline, not a claim about a named vendor's implementation.

## Findings

| Severity | ID | Finding | Impact |
| --- | --- | --- | --- |
| MEDIUM | `auth-service-unverified-email-squatting` | Public sign-up lets attackers claim an unverified email address | An attacker can create an owner shop under a previously unused target email and block its rightful holder from registering. |
| LOW | `auth-service-email-login-lockout` | Unauthenticated users can lock out a known email address | Eleven failed attempts block sign-in for that address until the 15-minute window expires. |

### MEDIUM — Public sign-up lets attackers claim an unverified email address

**Affected code:** `frontend/src/server/auth-actions.ts`, `backend/src/auth.service.ts`, `backend/src/shop-setup.service.ts`.

An unauthenticated attacker submits a business owner's email address that has not yet been registered, chooses a password, receives a session, and completes shop onboarding. The app never proves that the attacker controls the email. Since email is unique, the rightful holder then receives the duplicate-account response and cannot register under that address. The created shop is controlled by the attacker and could be presented as the business's storefront. There is no evidence that this reaches an existing account or its data; account recovery is an operator process in the reviewed product documentation.

Require email verification before issuing an authenticated session or allowing shop setup. Enforce verified status in backend login and onboarding paths.

### LOW — Unauthenticated users can lock out a known email address

**Affected code:** `frontend/src/server/auth-actions.ts`, `backend/src/auth.service.ts`, `backend/src/rate-limit.service.ts`.

The public sign-in action forwards requests to the guarded API using a server-held internal token, so a visitor does not need that secret or an account. `AuthService.signIn` increments a shared counter keyed only by normalized email before password verification. After ten attempts, request 11 and subsequent attempts receive 429 for the same address until the 15-minute window expires. A targeted visitor can therefore prevent a known user from signing in for up to 15 minutes, without affecting other addresses.

Use rate controls that do not let arbitrary unauthenticated callers create an account-wide lockout. Apply throttling using a trusted source address with progressive delay or challenge controls, and avoid a hard account-wide denial based only on a caller-supplied email.

## Residual risk and open questions

- **Public LINE webhook buffers requests before signature validation:** the route buffers the full request body and performs an internal webhook-config lookup before validating the LINE signature. Repeated large unsigned requests could create memory/API/DB pressure if deployment ingress does not cap body size and concurrency. The repository does not establish hosting limits; verify them or add an application-level cap before treating this as exploitable.
- **Forwarded address may be spoofable for POS pairing throttling:** the pairing action derives its key from `x-real-ip` or the first `x-forwarded-for` value. Whether production ingress overwrites/sanitizes these headers was not verified. If caller-controlled values survive, callers may obtain new buckets and increase guesses against six-digit pairing codes. Verify proxy behavior and use only trusted forwarding metadata.
- Signup does not verify addresses before allowing account creation; this is finding `auth-service-unverified-email-squatting`. Product documentation acknowledges verification is absent but does not establish acceptance of account-claiming risk.
- Supply-chain hardening remains available: pin GitHub Actions to immutable commit SHAs and consider pnpm policy controls for exotic transitive sources, release age, and trust downgrade protection. Scanner output did not identify a compromised action or malicious dependency.
- External rate limiting, ingress body limits, secret rotation, production network boundaries, and database grants were not reviewed.

## Hardening notes

- Add explicit `authTagLength: 16` to AES-GCM decryption to make the intended authentication-tag size clear. Manual review found no attacker-controlled ciphertext or decryption oracle, so the Semgrep alert is not a confirmed vulnerability.
- The six-digit pairing code is one-time and expires after ten minutes, with an application throttle. Confirm proxy header handling and consider an additional shop-wide limit if deployment testing supports it.

## Positive security patterns

- Internal API controllers use an HMAC-derived shared token and timing-safe comparison; browser CORS is disabled.
- Passwords and staff PINs use salted scrypt; application sessions and POS device tokens are random, stored hashed by the API, and expired/revoked. Cookies are HttpOnly and SameSite=Lax, with Secure enabled in production.
- Admin actions derive shop scope from the authenticated staff session. Checkout recomputes pricing, validates modifiers, scopes members/rewards/products to the shop, and commits checkout/idempotency state transactionally.
- LINE webhook events are signature-checked before parsing or event handling; LIFF subject identity is verified with LINE using the configured channel ID.
- Logo uploads are size-bounded, strict-base64 decoded, image-magic checked, and served with `nosniff`; CSV formula-leading cells are escaped.
