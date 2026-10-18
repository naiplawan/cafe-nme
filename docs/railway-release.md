# Railway release and database recovery

The frontend and Nest API are separate Railway services backed by Railway PostgreSQL. Database migrations belong to the API release.

## API service settings

Use these commands from the workspace root in the backend service's build/deploy settings:

- Build: `pnpm --filter @cafenme/backend build`
- Pre-deploy: `pnpm --filter @cafenme/backend db:migrate`
- Start: `pnpm --filter @cafenme/backend start`
- Healthcheck: `/health/ready`

Configure `RESEND_API_KEY`, `EMAIL_FROM`, and the public frontend origin as `APP_BASE_URL` on the API service. On the frontend service, production ingress must overwrite `x-real-ip` with the connecting client address. Signup, login, and POS pairing fail closed when that trusted address is unavailable or invalid; `x-forwarded-for` is not used for these limits.

The image must retain `backend/drizzle`, its metadata, and the dependencies for the migration command. Railway runs the pre-deploy command with the service's private network and environment. A failed migration must stop the deployment. Do not publish PostgreSQL networking or create another credential merely to run a release migration.

`/health` reports process liveness. `/health/ready` requires the database to contain the deployed migration head with its matching SQL hash. A newer database also supports an older API while that older API's required migration remains in history.

References: [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [Railway healthchecks](https://docs.railway.com/deployments/healthchecks).

## Account identity

Email addresses remain the account identifier and login credential. New accounts must verify mailbox ownership before they can sign in or create a shop. The API sends verification mail through Resend. Configure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` on the API service before enabling signup; missing configuration fails signup closed. Existing accounts are retained as verified by the additive migration. Password recovery remains operator-managed through the existing database access procedure.

## Release sequence

1. Review the complete change and its verification evidence. Confirm the exact API and frontend commits to deploy.
2. Before a schema change, confirm the PostgreSQL backup/recovery configuration and take a restorable backup using existing authorized database access. Record its identifier and retention without logging connection strings.
3. Apply migrations in the API pre-deploy step. Migration `0016_restore_email_verification` restores verification state and token storage; existing accounts remain verified, while new accounts are pending until they use a one-time link that expires after 24 hours. Historical migrations `0013_password_reset`, `0014_email_verification`, and `0015_remove_email_auth_state` remain unchanged. Migration `0012_checkout_idempotency` adds nullable columns and a unique index. Migration `0011_clear_demo_promptpay` changes only the known demo shop placeholder; it intentionally has no schema snapshot.
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
