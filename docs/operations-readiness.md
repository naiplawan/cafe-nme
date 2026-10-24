# Operations readiness

The backup/restore and notification paths below were exercised against disposable local PostgreSQL and a local HTTP receiver. This is **local drill evidence**, not proof of a production backup, disaster recovery time, or delivery to an operator. No external notification destination has been enabled.

## Restore drill

Prerequisites: Node dependencies installed, matching PostgreSQL client tools (`pg_dump`, `pg_restore`) on PATH, a readable source database, and a separately provisioned **empty, isolated target database**. The source account needs access to every application table. Keep the target exclusively reserved for the drill; the safety check does not prevent another client from creating objects afterward. Pause source DDL and sequence-changing writes during the drill. The repeatable-read exported snapshot makes table data and the custom-format backup consistent.

Provide `RESTORE_SOURCE_URL` and `RESTORE_TARGET_URL` through the process environment/secret manager, then run:

```sh
node backend/scripts/restore-drill.mjs > restore-evidence.json
```

The script does not load `.env` files. Never put production credentials in shell history. It rejects equal endpoint/database URLs, checks the server-reported database identity to catch host aliases, and rejects target user tables, sequences, routines, types, or additional schemas. It never issues DROP or cleans an existing target. Restore uses `--single-transaction --exit-on-error`; a failed verification leaves the isolated target available for investigation. Provision a new empty target for another run.

The source is dumped in custom format into a private temporary directory. The archive is restored with ownership/ACL restoration disabled, then removed after the drill. The comparison covers the normalized schema (including constraints/indexes) and row counts plus order-independent row digests for every user table, including migration history. Duplicate rows contribute separately. Evidence contains hashed database identities, archive/schema SHA-256 checksums, table names/counts/content digests, and elapsed milliseconds. It contains no connection URL, row values, or exception text. A successful exit and `ok: true` are both required. Failure returns sanitized JSON and exit code 1.

This is a logical database drill: it does not validate backup retention, encryption at rest, offsite access, roles/permissions, object storage, or production RPO/RTO. Table digests are in-database MD5 checksums for accidental corruption detection, not adversarial integrity protection. Large tables may need a larger database work-memory/storage budget. Individual PostgreSQL subprocesses are bounded to five minutes. Database query duration depends on the dataset. PostgreSQL sequence state is restored by pg_restore and covered by the local integration test; it is not included in the JSON data comparison.

Run regression coverage against a disposable PostgreSQL cluster (the account must be allowed to create databases):

```sh
# Set OPS_TEST_SERVER_URL to the disposable cluster's maintenance database.
pnpm --filter @cafenme/backend exec tsx --test test/restore-drill.test.ts
```

Without `OPS_TEST_SERVER_URL`, the database integration test is explicitly skipped. With it, the test creates two uniquely named databases, verifies duplicate rows, a check constraint, sequence continuation, and rejection of a populated target without modifying its rows. It intentionally leaves those databases in the disposable cluster; deleting the cluster afterward is an operator action.

Local initial drill on 2026-10-23: 24 tables and 24 migration records; backup/restore/schema/data comparison passed in 311 ms. On 2026-10-24, the final application schema was restored into a separate empty database: all 37 source tables matched row counts and content digests, normalized schema comparison passed, and the run completed in 543 ms. A second invocation against a populated target was refused. These disposable local databases do not represent production volume, backup retention, live payment correctness, or production recovery time.

## Failure notifications

Set `OPERATIONAL_ALERT_WEBHOOK_URL` separately on the backend and frontend server only after an operator supplies and authorizes the receiver. Do not expose it through a `NEXT_PUBLIC_` variable. Use an HTTPS receiver in deployment. The receiver must accept JSON POSTs and return a 2xx status; this is a generic webhook contract, not a Slack/Teams-specific payload adapter.

The backend filter emits `api_5xx` for HTTP 5xx errors. The checkout server action emits `checkout_failure` for unexpected API/transport failures while preserving the unresolved checkout/retry response. Expected checkout domain errors do not alert. Payloads contain kind, optional HTTP status, and optional SHA-256 request/shop identity hashes. Request bodies, payment details, staff/member identifiers, URLs, raw paths, exception messages, and stack traces are excluded from webhook payloads. Existing application error logs remain available for diagnosis.

Each process has a bounded 60-second window with at most ten sends and one send per kind/status/shop combination. Request IDs do not bypass deduplication. Failed deliveries count against the cap. This suppression is process-local, resets on restart, and does not provide durable queuing or fleet-wide limits. Delivery has a one-second timeout, rejects redirects, and logs a fixed message on network/HTTP failure without logging the webhook URL. Checkout awaits this bounded attempt; API error responses do not await it. A process stopping immediately can lose an in-flight API notification. No retry or fallback notification service is configured.

An absent destination returns `unconfigured`; it is not reported as delivered. Local tests cover actual HTTP receipt, redacted payloads, expected-error exclusion, duplicate suppression, the ten-send cap, non-2xx failure, and timeout. Run:

```sh
pnpm --filter @cafenme/backend exec tsx --test test/http-exception-filter.test.ts test/operational-alert.test.ts
pnpm --filter @cafenme/frontend exec vitest run src/app/pos/checkout-actions.test.ts
```

Before calling production operations ready, the owner must record the authorized destination, a real end-to-end delivery/acknowledgement, backup retention and access policy, an isolated restore of the real backup, recovery validation, measured RPO/RTO, and the responsible responder. These remain deployment gates.
