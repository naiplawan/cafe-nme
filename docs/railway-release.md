# Railway release and database recovery

The frontend and Nest API are separate Railway services backed by Railway PostgreSQL. Database migrations belong to the API release.

## API service settings

Use these commands from the workspace root in the backend service's build/deploy settings:

- Build: `pnpm --filter @cafenme/backend build`
- Pre-deploy: `pnpm --filter @cafenme/backend db:migrate`
- Start: `pnpm --filter @cafenme/backend start`
- Healthcheck: `/health/ready`

The image must retain `backend/drizzle`, its metadata, and the dependencies for the migration command. Railway runs the pre-deploy command with the service's private network and environment. A failed migration must stop the deployment. Do not publish PostgreSQL networking or create another credential merely to run a release migration.

`/health` reports process liveness. `/health/ready` requires the database to contain the deployed migration head with its matching SQL hash. A newer database also supports an older API while that older API's required migration remains in history.

References: [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [Railway healthchecks](https://docs.railway.com/deployments/healthchecks).

## Account email

The API sends formal Thai registration-verification, welcome, password-reset, and password-changed emails through Resend's HTTPS API. New production accounts cannot log in until the 24-hour verification link is confirmed. The API returns a generic response when a verification link is resent, whether or not the address has an unverified account. Reset links expire after 30 minutes and can be used once. A successful password reset also verifies the address. If sending a welcome or password-changed notice fails, the completed operation remains successful and the API logs the delivery error. A signup or reset request returns an error when its required email cannot be sent.

Migration `0014_email_verification` marks existing users verified by default and adds single-use verification tokens. New signups explicitly start unverified. During local development, signups remain usable without an email API key by being marked verified. Production signup requires all three email variables below.

Resend uses HTTPS and works on Railway Hobby, which blocks outbound SMTP. Verify a sender domain in Resend and configure its recommended DNS records before sending to customer addresses. See [Railway's email delivery requirements](https://docs.railway.com/networking/outbound-networking) and [Resend's email API](https://resend.com/docs/api-reference/emails/send-email).

Configure these variables on the API service:

| Variable           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| `APP_URL`          | Public frontend origin used to build authentication links |
| `RESEND_API_KEY`   | Resend API key stored as a Railway secret                |
| `EMAIL_FROM_EMAIL` | Verified sender, such as `Cafe'nMe <no-reply@example.com>` |

Keep the API key in Railway's service variables, not in the repository. Resend's test sender is restricted to verified test recipients; use a verified domain for real customer email.

## Release sequence

1. Review the complete change and its verification evidence. Confirm the exact API and frontend commits to deploy.
2. Before a schema change, confirm the PostgreSQL backup/recovery configuration and take a restorable backup using existing authorized database access. Record its identifier and retention without logging connection strings.
3. Apply additive migrations in the API pre-deploy step. Migrations `0013_password_reset` and `0014_email_verification` add the password-reset and verification token tables; `0014` defaults existing and old-code-created accounts to verified while new code explicitly inserts unverified accounts. Migration `0012_checkout_idempotency` adds nullable columns and a unique index. Migration `0011_clear_demo_promptpay` changes only the known demo shop placeholder; it intentionally has no schema snapshot.
4. Wait for API deployment success and `/health/ready`. Only then deploy the frontend that uses the new API behavior.
5. Inspect owner settings, cash checkout, PromptPay availability, and an identical-key retry with disposable fixtures before accepting the release. Do not test transfers or create paid production orders as a smoke check.
6. Record deployment IDs, commit IDs, migration evidence, and any environment-specific limitations.

## Recovery

- If pre-deploy fails, keep the previous deployment active and inspect the failure before another attempt.
- If readiness fails, compare the deployed SQL/journal with migration history through existing authorized access. Run the normal migration tool for missing migrations; do not fabricate migration history rows or bypass readiness.
- A failed migration should roll back through the migration tool's transaction. Verify its actual state before retrying.
- If application rollback is needed after migration `0012`, restore the older API/frontend deployment while retaining the additive columns. Do not drop checkout request keys/results: they prevent a delayed retry from recording another sale.
- For destructive recovery, restore the verified backup into a separate database first and compare its state before changing production traffic.

## Current production evidence

The previous delivery cleared the seeded demo PromptPay value through the authenticated owner UI. It did not establish that migration `0011` had been recorded by Drizzle. The next reviewed API release must run the normal pre-deploy migration step and record evidence of success. Do not infer migration history from the visible payment form alone.
