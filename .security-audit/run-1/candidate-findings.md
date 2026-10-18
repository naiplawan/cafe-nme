# Candidate Findings and Dispositions

### Public login action allows targeted account lockout

- Source agent: auth/session hunter; independently confirmed by a separate verifier
- Claimed attacker: unauthenticated visitor who knows or guesses a user's email address
- Claimed attack: submit 11 failed sign-in attempts for that email within 15 minutes through the public login Server Action
- Claimed impact: block that user from signing in for the remainder of the 15-minute window; repeatable
- Affected files: `frontend/src/server/auth-actions.ts`, `backend/src/auth.service.ts`, `backend/src/rate-limit.service.ts`
- Duplicate of: none
- **Disposition:** confirmed
- Evidence: `AuthService.signIn` increments a shared counter keyed only by normalized email before password verification. Attempt 11 and later return 429. The public `signIn` action calls the API with the server-held internal token, so the caller does not need that token or an account.

### Unverified email can be used to create a new account under an unused address

- Source agent: auth/session hunter
- Claimed attacker: unauthenticated visitor
- Claimed attack: register a not-yet-registered business email and create a shop under the resulting account
- Claimed impact: reserve that email and prevent its legitimate holder from registering with it
- Affected files: `backend/src/auth.service.ts`, `frontend/src/server/auth-actions.ts`, `backend/src/shop-setup.service.ts`
- Duplicate of: none
- **Disposition:** confirmed
- Evidence: a separate verifier confirmed the public sign-up action immediately creates an account/session from the submitted address. The authenticated onboarding flow then creates an owner staff row and shop tied to that account. The unique email constraint prevents the rightful holder from registering afterward. It does not take over an existing account or access pre-existing data; the impact is targeted account squatting, storefront impersonation risk, and registration denial. The release docs acknowledge missing email verification, but do not show that this identity-claim risk was consciously accepted.

### Public LINE webhook buffers requests before signature validation

- Source agent: public-surface and injection/resource hunters
- Claimed attacker: unauthenticated network client who knows a configured shop's webhook path
- Claimed attack: repeatedly send large unsigned request bodies; each request is buffered and triggers an internal webhook-config lookup before signature rejection
- Claimed impact: memory and database/API pressure
- Affected files: `frontend/src/app/api/line/webhook/[shopId]/route.ts`
- Duplicate of: none
- **Disposition:** needs-more-evidence
- Evidence: `request.text()` runs before signature validation, and `getWebhookConfig()` runs before it as well. No application-level body cap is present in this route. Deployment ingress limits and request concurrency limits were unavailable, so meaningful resource impact is not established. This question is carried into `REPORT.md` under residual risk.

### Forwarded address may be spoofable for POS pairing throttling

- Source agent: auth/session hunter
- Claimed attacker: unauthenticated visitor
- Claimed attack: vary a caller-supplied `x-real-ip` or first `x-forwarded-for` value to obtain new pairing rate-limit buckets
- Claimed impact: increase guesses against short-lived six-digit device pairing codes
- Affected files: `frontend/src/app/pos/pair/actions.ts`
- Duplicate of: none
- **Disposition:** needs-more-evidence
- Evidence: the action keys its 20-attempt/10-minute throttle from those request headers. Whether the production ingress overwrites or sanitizes them is deployment-specific and was not verified. This question is carried into `REPORT.md` under residual risk.

### AES-GCM tag-length scanner alert

- Source agent: Semgrep; manually reviewed by crypto hunter
- Claimed attacker: attacker able to submit ciphertext for decryption
- Claimed attack: supply a shortened authentication tag to forge encrypted LINE credentials
- Claimed impact: forge stored LINE credentials
- Affected files: `frontend/src/lib/crypto.ts`
- Duplicate of: none
- **Disposition:** rejected
- Evidence: encrypted values are produced internally with fresh 12-byte nonces and full default GCM tags; the observed decryption path reads stored webhook configuration behind the internal API boundary. No attacker-controlled ciphertext input or verification oracle was found. The Semgrep alert is a hardening suggestion to specify the expected tag length explicitly.

### Scanner supply-chain policy alerts

- Source agent: Semgrep
- Claimed attacker: upstream GitHub Action or package source maintainer
- Claimed attack: repoint a mutable Action tag or introduce malicious dependency updates
- Claimed impact: execute code in CI or application build
- Affected files: `.github/workflows/ci.yml`, `pnpm-workspace.yaml`
- Duplicate of: none
- **Disposition:** rejected as confirmed vulnerabilities; retained as hardening notes
- Evidence: alerts identify mutable tags and missing pnpm supply-chain policy settings, but no compromised upstream component or malicious dependency was identified. These are supply-chain controls to improve, not an exploit demonstrated in the current code.
