# POS acceptance checks

## Automated browser checks

`pnpm test:e2e` runs Chromium at a 1280 × 800 tablet viewport against production
Next.js and Nest builds, with real server actions and PostgreSQL. It covers:

- Device pairing and staff PIN login.
- A ฿500 opening float, two ฿60 drinks with ฿10 modifiers, ฿200 tendered and ฿60 change.
- Receipt content and preparation progressing to ready, persisted across reload.
- A ฿70 partial refund: approval leaves expected cash at ฿640; recording the cash
  payout reduces it to ฿570; closing at ฿570 records zero difference.
- Read-back of the closed shift cash statement, frozen count, actual refund reference and matching entry count.
- Rejection of a cash sale after the shift closes.
- A checkout response dropped **after** the server responds: reloading and
  recovering produces the same order and only one payment.
- An empty cart after recovery and disabled checkout while offline.
- Oat replacing dairy, reservation at checkout, a one-cup cancellation before
  preparation, and an idempotent remake without an additional payment.
- Drawer top-up, petty cash and bank deposit reconciling to a zero-difference close.

The tests do not transfer money or contact a payment provider. Receipt assertions
check browser content, not physical printing. Each test creates its own shop and
deletes that shop and its own pairing/login rate-limit entries on teardown.
Failures retain a Playwright trace and screenshot.
Retries are disabled.

Create an empty, disposable local PostgreSQL database named `cafe_pos_e2e`, then:

```sh
pnpm --filter @cafenme/frontend exec playwright install chromium
E2E_DATABASE_URL=postgresql://localhost/cafe_pos_e2e pnpm test:e2e
```

Use a local test role and port appropriate for your machine. The runner refuses
non-local hosts or other database names and never falls back to `DATABASE_URL`.
It applies migrations without dropping the database. The dedicated ports 3210
and 3211 must be free; it will not reuse an existing application server. The
frontend production build uses `frontend/.next`, so stop local Next development
before running. App secrets are test-only values and outbound payment, email and
alert settings are disabled for these servers.

CI creates a separate database and runs the same command. Inspect failures with:

```sh
pnpm --filter @cafenme/frontend exec playwright show-report
```

## Shop pilot checks requiring real equipment or accounts

Record the date, operator, device/browser, result and evidence for each check.
Do not treat automated local results as live payment or printer validation.

| Check | Pass condition |
| --- | --- |
| Tablet and receipt printer | Thai text, modifiers, totals and long receipts print correctly; reprinting does not create another sale. |
| Counter payment | Staff distinguish cashier-confirmed PromptPay from provider-verified payment and reconcile it with actual received money. |
| Provider payment, if enabled | An authorized small payment on the shop account completes via its real webhook, with matching amount and order; pending/failed payment remains unfulfilled. |
| Connection interruption | Staff recover the original pending checkout before taking another payment; reconnection does not duplicate a sale. |
| Full working day | Sales, refunds, closing cash, stock consumption and loyalty changes reconcile with actual activity. |
| Backup recovery | Restore a real backup into an isolated target, verify data, and record retention and measured recovery time. |
| Operator notification | A controlled failure reaches the configured operator and is acknowledged. |

Live merchant configuration and physical-device checks remain deployment work;
see [payment setup](omise-payments.md) and [operations readiness](operations-readiness.md).
