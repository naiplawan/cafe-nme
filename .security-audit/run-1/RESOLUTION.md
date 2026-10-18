# Security Audit Resolution

The findings in `REPORT.md` and `findings.json` are the original audit snapshot from before remediation. Source fixes were applied in the working tree on 2026-10-18.

## Confirmed findings

- `auth-service-unverified-email-squatting` — **Remediated in source.** Signup now creates a pending user, stores only a hash of a random one-time token, sends a 24-hour verification link through Resend, and returns no session. Login requires `email_verified_at`. A new pending registration for the same unverified address rotates its password and token so the mailbox owner can recover an address claimed by an attacker. Signup throttling is source-address based, so it cannot reserve the retry allowance by targeting an email. Migration `0016_restore_email_verification` preserves all existing users as verified while restoring token storage. API deployment requires `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL`; signup fails closed if any are missing.
- `auth-service-email-login-lockout` — **Remediated in source.** Login attempts are limited by validated `x-real-ip` only, not by email. Production requests without a valid proxy address fail closed; local development falls back to loopback. This prevents a third party from exhausting a shared email bucket and blocking its owner.

## Source-fixable residuals

- LINE webhook bodies are now read incrementally with a 1 MiB cap before the app fetches shop webhook configuration. Oversized requests return 413. Signature validation still requires retrieving the configured secret first.
- POS pairing now uses eight-digit random codes, validates and buckets only `x-real-ip`, and does not accept `x-forwarded-for`. Production pairing fails closed if the proxy address is missing or invalid. Confirm that production ingress overwrites `x-real-ip`; source code cannot establish that deployment property.

## Verification

- `pnpm typecheck` — passed for frontend and backend.
- `pnpm test` — passed, 239 frontend tests across 48 files.
- `pnpm --filter @cafenme/backend test` — passed; PostgreSQL-dependent tests were skipped because no test database was configured.
- Targeted security behavior tests — passed for login and signup rate-limit keys, eight-digit pairing validation, and bounded webhook body reading.
- `pnpm lint` — exit code 0; repository-wide existing output includes warnings and informational diagnostics in unrelated files.

These source changes do not establish that migration 0016 has been applied or that production email settings and proxy headers are configured. Apply the migration through the documented API pre-deploy process and configure the three Resend-related API variables before enabling signup.
