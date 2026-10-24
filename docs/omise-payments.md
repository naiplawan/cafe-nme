# Omise PromptPay for accepted QR orders

Provider payments are available only after staff accept a public QR order. The server freezes the accepted order's lines, amount, shop, draft, staff member, and intent ID before calling Omise. It creates at most one charge intent per draft. If a response is lost or its status cannot be found, the intent remains uncertain and staff must check that same intent; the application never starts a replacement charge automatically.

Configure `OMISE_SHOP_SECRET_KEYS` on the backend as a JSON object keyed by the exact shop UUID, for example `{"shop-uuid":"skey_test_…"}`. Keep test credentials in test environments. Live credentials are ignored unless `OMISE_LIVE_ENABLED=true`; enable this only after the shop account and webhook have been verified. Never place these values in frontend or `NEXT_PUBLIC_` variables. The application checks the account mode returned by Omise and stores the account identity with the intent.

Set each shop's Omise webhook URL to `https://<backend-origin>/v1/provider/omise/shops/<shop-uuid>/webhook`. The webhook payload supplies an event ID only. The backend fetches that event and its charge from Omise with that shop's secret, then checks account mode, shop/draft/intent metadata, PromptPay source, amount, currency, and successful paid status before checkout. Duplicate events are safe. The endpoint acknowledges unrecognized events without settling a bill; monitor application delivery and provider event logs when investigating callbacks.

Staff can inspect or refresh the same intent from **POS → QR orders → Choose payment method**. Cashier-recorded PromptPay remains a staff report and never appears as provider-verified. Only a completed provider intent is shown as confirmed by Omise in reconciliation. A verified charge whose draft can no longer be fulfilled remains `paid_unfulfilled` for staff support; it is not represented as a completed sale.

The implementation enforces Omise PromptPay's 20–150,000 THB range. Omise's PromptPay documentation says PromptPay charges cannot be refunded through the API; refunds in this application are an approval record followed by a separately recorded real payout. Do not mark an Omise refund as automatic.

Backend tests use a fake Omise API and a disposable PostgreSQL database. They cover pending QR creation, forged webhook bodies, concurrent duplicate events, lost create responses, amount mismatch, and paid-but-unfulfilled retry. This does not prove a merchant's live account, webhook delivery, settlement timing, or live refunds. Before enabling live mode, a shop operator must complete a small authorized end-to-end payment and callback check.

Primary provider references: [PromptPay](https://docs.omise.co/promptpay), [Charges API](https://docs.omise.co/charges-api), [Events API](https://docs.omise.co/events-api), and [API webhooks](https://docs.omise.co/api-webhooks).
