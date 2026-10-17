# Cafe'nMe + LINE Membership: MVP Plan

A POS for Thai coffee shops and cafés, with a stamp-card membership that lives inside LINE.

## 1. Decisions

| Topic | Decision |
|---|---|
| Positioning | **LINE membership first**: a stamp card in LINE that owners set up in 10 minutes. The POS is simple but fast. |
| Tenancy | **Multi-tenant data model** (every row has `shop_id`); pilot with **one real café** |
| v1 includes | Menu, add-ons, POS ordering, cash and PromptPay, receipts, LINE membership with stamps, daily reports |
| v1 excludes | Stock and recipes, kitchen display, tables, delivery, multiple branches, payroll, tax invoices, offline mode |
| Payment | **Dynamic PromptPay QR with the exact amount**; the barista taps "Paid" after checking their bank app (no gateway) |
| Tax | Target **shops that aren't VAT-registered** and issue plain receipts only. This avoids the Revenue Department approval required for POS machines (อนุมัติเครื่องบันทึกการเก็บเงิน). |
| Hardware | **Android tablet with Chrome**. Receipts go through LINE by default; Bluetooth thermal printing is optional, through Web Bluetooth. |
| Offline | Online-only, with a clear "offline" banner that blocks checkout |
| LINE OA | **Each shop uses its own Official Account.** For the pilot, set up the channels by hand. |
| LINE messages | Stamps show in LIFF and the rich menu. **Push messages only when a reward unlocks**, to protect the message quota. |
| Membership | **Stamps**, e.g. 10 stamps = 1 free drink. Configurable per shop; stamps expire after 12 months. |
| Member lookup | **Member QR in LIFF that changes every 60 seconds**, with a phone number lookup as fallback |
| PDPA | Consent checkbox, privacy policy page, and a "delete my data" button in LIFF |

## 2. Architecture

```
┌──────────── Next.js (App Router) on Vercel ─────────────┐
│ /admin   Owner back office  (email login)                  │
│ /pos     Tablet POS         (device pairing + staff PIN)   │
│ /liff    Member app in LINE (LIFF ID token)                │
│ /api/line/webhook/[shopId]   LINE events, signature check  │
│ Server Actions → service layer → Drizzle → Postgres        │
└────────────────────────────────────────────────────────────┘
        │                    │                    │
   Railway PostgreSQL  LINE Messaging API     LINE Login / LIFF
   (+ Realtime later)  (push, rich menu)      (member identity)
```

**Stack:** Next.js 16 with TypeScript, NestJS, Railway PostgreSQL, Drizzle ORM, database-backed app sessions, shadcn/ui with Tailwind, Zod, `@line/bot-sdk`, `@line/liff`, `promptpay-qr` with `qrcode`, `@zxing/browser` for camera QR scanning, Vitest and Playwright.

**Conventions**
- Money is stored as integers in **satang**, never floats.
- All times use the Asia/Bangkok timezone; daily order numbers reset each day (#001, #002…).
- Every query goes through a service layer that requires `shopId`; the app enforces shop scope in its services.
- Order lines store a **snapshot** of names and prices, so menu edits never change past receipts.
- LINE channel secrets and tokens are encrypted at rest.

## 3. Data model

```
shops            id, name, slug, timezone, receipt_footer, stamp_goal, stamp_expiry_months
staff            id, shop_id, name, role(owner|manager|barista), pin_hash, auth_user_id?
pos_devices      id, shop_id, name, device_token_hash, last_seen_at

categories       id, shop_id, name, sort
products         id, shop_id, category_id, name, base_price_satang, image_url, is_active, earns_stamp
modifier_groups  id, shop_id, name, min_select, max_select      -- e.g. "Sweetness" 1..1
modifiers        id, group_id, name, price_delta_satang, sort   -- "50%" +0, "Oat milk" +15
product_modifier_groups  product_id, group_id, sort

orders           id, shop_id, daily_no, status(open|paid|void), member_id?, staff_id,
                 subtotal_satang, discount_satang, total_satang, created_at, paid_at
order_items      id, order_id, product_id, name_snapshot, unit_price_satang, qty, note
order_item_modifiers  order_item_id, name_snapshot, price_delta_satang
payments         id, order_id, method(cash|promptpay), amount_satang, cash_received_satang?, confirmed_by

members          id, shop_id, line_user_id?, phone?, display_name, consent_at, deleted_at?
stamp_ledger     id, shop_id, member_id, order_id?, delta, reason(earn|redeem|expire|adjust), staff_id, created_at
rewards          id, shop_id, member_id, status(available|redeemed|expired), redeemed_order_id?

line_channels    shop_id, messaging_channel_id, channel_secret_enc, access_token_enc,
                 login_channel_id, liff_id, rich_menu_id
audit_log        id, shop_id, actor, action, payload, created_at
```

The stamp ledger is **append-only**: a member's balance is `SUM(delta)`, which keeps an audit trail and makes reversals easy.

## 4. Screens

### POS (landscape tablet, large tap targets)
1. Pair device (one time, with a code from admin), then choose staff and enter PIN.
2. Order screen: categories on the left, product grid in the middle, cart on the right.
3. Add-on sheet that opens when a product is tapped: sweetness, hot or iced, milk, size, extra shot, note.
4. Member bar: **Scan** (camera, or a USB scanner that types into a field) or **phone number**. Shows stamps and whether a reward is available.
5. Payment: Cash (quick buttons for 100/500/1000 and change calculation) or PromptPay (full-screen QR, then "Paid").
6. Done: send the receipt by LINE if the customer is a member, and/or print. Then start a new order.
7. Today's orders: view, reprint, void (manager PIN required; stamps are reversed).

### Admin
Dashboard (today's sales, cups, members), menu and add-on editor, staff and PINs, POS devices, membership settings (stamp goal, expiry, reward item), LINE connection (credentials, test button, rich menu setup), member list, reports with CSV export.

### LIFF (member)
Registration (LINE profile, phone, PDPA consent), member card (rotating QR, stamp grid, reward count), history, profile and delete data.

## 5. Main flows

### Member check-in at the POS
1. LIFF gets the LINE ID token, and the server verifies it with LINE's verify endpoint.
2. The server returns a signed token, `HMAC(member_id + 60-second window)`, which LIFF shows as a QR code.
3. The POS scans it, and the server checks the signature and the window (current or previous) and attaches the member to the order.

### Earning and redeeming stamps
- When an order is paid, add +1 stamp for each item where `earns_stamp` is set.
- When the balance reaches the goal, add `-goal` to the ledger and create a reward with status available. This sends **one push message**: "🎉 ได้เครื่องดื่มฟรี 1 แก้ว".
- To redeem, the barista taps the reward in the member bar and the cheapest eligible item becomes free.
- Voiding an order reverses its ledger entries in the same transaction.

### LINE webhook
- `follow` event: reply with a welcome message and the registration link (reply messages are free).
- Rich menu buttons: "บัตรสมาชิก" (member card), "แต้มของฉัน" (my stamps) and "เมนู" (menu), each opening LIFF.

## 6. Milestones (6 weeks at about 8 hours a week)

**Before week 1:** sit in the café for one rush hour and write down their real menu and add-ons.

| Week | Deliverable | Done when |
|---|---|---|
| 1 | Project setup, PostgreSQL, Drizzle schema, admin login, menu and add-on CRUD | Owner can build the menu from a real café |
| 2 | POS: pairing, PIN, order screen, add-ons, cart, cash payment | You can ring up 20 orders without errors |
| 3 | PromptPay QR, order history, void, receipt (Bluetooth print as a spike) | Correct QR amount; voids are logged |
| 4 | LINE OA and Login channels, webhook, LIFF registration, PDPA, member card QR | Your own phone registers and shows a rotating QR |
| 5 | POS scan and phone lookup, stamp earning, rewards, push on reward, rich menu | Full loop from register to 10 orders to free drink |
| 6 | Reports and CSV, polish, **pilot in the café for a week**, bug fixes | The café uses it for real orders for a week |

## 7. Testing and quality

- **Vitest** for price calculation, add-on limits, the stamp ledger and expiry, QR token signing, and day boundaries in Bangkok time
- **Playwright** for the main POS checkout flow and the member flow, with LIFF mocked
- CI runs `tsc --noEmit`, `eslint --max-warnings 0`, Vitest and Playwright
- Logging with a proper logger (e.g. pino) and Sentry for errors, not `console.log`

## 8. Costs (pilot)

- **Railway PostgreSQL:** deploy the app database alongside the API.
- **Vercel:** Hobby works during development, but its terms forbid commercial use, so move to **Pro (about $20 a month)** before charging anyone.
- **LINE OA:** the free plan should be enough with pushes only on rewards. Check the current Thai message quota.
- **Domain:** about 400 baht a year. LIFF needs HTTPS.

## 9. Risks

| Risk | Mitigation |
|---|---|
| The café won't switch POS systems | Offer **membership-only mode** (stamps without the POS) as a fallback |
| Onboarding each shop's LINE channels is hard | Write a step-by-step guide with screenshots; consider one shared OA later |
| Bluetooth printing doesn't work on their device | LINE receipts by default; test printing in week 3 |
| Wifi drops at rush hour | Make the offline banner obvious; plan offline mode for v2 |
| Customers share member QR screenshots | 60-second rotating token |
| PDPA complaints | Consent, privacy policy, delete button, minimal data collected |

## 10. After the MVP

Points per baht and tiers, birthday rewards, promotions to member segments, PromptPay confirmation through a payment gateway or slip check, offline mode, kitchen and bar display (managed PostgreSQL change feed), multiple branches, ingredient stock, VAT-registered shops (RD-approved POS), self-signup for shops and billing.
