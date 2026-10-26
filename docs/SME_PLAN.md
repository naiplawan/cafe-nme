# SME Template Plan: Retail and Restaurant

Turn YELO Coffee from a café POS into one multi-tenant POS where each shop picks a business type (`cafe`, `retail`, `restaurant`). The type controls the starter data, terminology and enabled modules. The codebase stays single: no per-client forks.

## Assumptions

- **One deployment serves every shop.** This is already true, because every table is scoped by `shop_id`.
- **Shops that aren't VAT-registered stay the target.** [PLAN.md](../PLAN.md) avoids Revenue Department POS approval, and this plan keeps that. VAT and full tax invoices are listed as a separate project (see "Out of scope").
- **Still online-only, and still no payment gateway.** Card payments are confirmed by hand from an external EDC terminal, the same way PromptPay is confirmed today.
- **The architecture doesn't change.** Business logic stays in `backend/src/*.service.ts` (raw SQL through `postgres`, schema in Drizzle), and the frontend `src/server/*` stays a thin client.
- **Existing café shops keep working** with no data changes beyond the migrations below.

## Decisions needed (recommended defaults in bold)

| # | Question | Options |
|---|---|---|
| D1 | Retail variants (size/colour) | **Each SKU is its own product in v1**; a `product_variants` table later |
| D2 | Selling with zero stock | **Allow and warn** (shop setting); block |
| D3 | Restaurant kitchen output | **Printed kitchen ticket first**; a kitchen display screen (KDS) in a later phase |
| D4 | Retail loyalty | **Shop chooses: stamps per item, or 1 stamp per ฿X spent** |
| D5 | Sale by weight (kg) | **Defer**: needs decimal quantity across pricing, receipts and reports |

---

## Phase 0: Foundations (shared by all types), ~2 weeks

The goal is that a new shop chooses a business type at onboarding and gets matching starter data. A café shop must look and behave exactly as it does today.

### 0.1 Business type and feature flags
- Migration `0007`: add `shops.business_type` (enum `cafe | retail | restaurant`, default `cafe`) and `shops.features` (jsonb).
- Add a new `backend/src/shop-features.ts`. It holds a Zod schema for `features` (`loyalty`, `inventory`, `tables`, `kitchen`) and the default for each business type. Expose the effective features with the shop/session payload, so the POS and admin can hide modules a shop doesn't use.
- Admin: a "Features" section on the shop settings page.

### 0.2 Remove café assumptions
- `staff_role`: `ALTER TYPE staff_role RENAME VALUE 'barista' TO 'staff'`, then update the 43 references in `backend/src` and `frontend/src`.
- `payment_method`: `ADD VALUE 'card'` and `'transfer'`. Add the buttons to `pos/_components/payment-dialog.tsx` (manual confirmation, like PromptPay), and add the methods to the reports payment mix.
- Terminology: a new `frontend/src/lib/terminology.ts` maps each business type to its words (item noun: แก้ว / ชิ้น / จาน, reward label, staff label). Replace the hard-coded "cups"/"เครื่องดื่ม" wording in reports, the admin dashboard, the POS done screen, the member panel, LIFF and `server/line.ts`.
- Rewards: add `shops.reward_label` (default "เครื่องดื่มฟรี 1 แก้ว") and use it in the LINE push message and on the LIFF card.
- Product name: read `APP_NAME` from env, defaulting to "YELO Coffee", wherever the app name appears.

### 0.3 Presets
- `backend/src/presets/{cafe,retail,restaurant}.ts`: categories, modifier groups, sample products, `reward_label` and default features.
- `shop-setup.service.ts#createShop` applies the preset in the same transaction. `scripts/seed-menu.ts` becomes "apply the cafe preset".
- `onboarding-form.tsx`: add a "ประเภทธุรกิจ" (business type) picker. The setup checklist adapts to the enabled features.

### 0.4 Discounts (both target types need them)
- `orders.discount_satang` already exists. Add a manual discount (amount or %) on the cart, requiring a manager PIN above a per-shop threshold. Write it to `audit_log`.

**Verify:** existing integration tests pass unchanged. New tests check that onboarding with each type seeds the matching preset, and that a café shop's POS output is identical before and after.

---

## Phase 1: Retail, ~3–4 weeks

The goal is a minimart or gift shop that scans barcodes, tracks stock and imports its catalog from a spreadsheet.

### 1.1 Catalog for many SKUs
- Migration: `products.sku`, `products.barcode` (unique per shop when not null), `products.cost_satang` (optional).
- CSV import and export in the admin menu page: preview, validate, upsert by SKU.
- POS: a search-first list layout when `business_type = retail`. Photos are optional and the grid stays for café/restaurant.

### 1.2 Barcode scanning
- USB/Bluetooth scanners act as a keyboard. Add a keystroke buffer in `pos-app.tsx`: fast input ending in Enter is treated as a scan, and it's ignored while a text field is focused.
- Camera fallback: reuse the `@zxing/browser` reader from `scan-dialog.tsx` with 1D barcode formats.
- `GET /catalog/barcode/:code` returns the product, or "not found" so the cashier can add it quickly.

### 1.3 Inventory
- Migration: `products.track_stock`, `products.stock_qty` (cached), `products.low_stock_threshold`, and an append-only `stock_ledger` table (`delta`, `reason: sale | void | receive | adjust | count`, `order_id?`, `staff_id`). This follows the stamp ledger pattern.
- `orders.service.ts#checkout`: in the same transaction, lock the tracked products (`for update`), decrement `stock_qty` and write `sale` rows. Apply D2: warn or reject with a new `CheckoutFailure` value, `out_of_stock`.
- `voidOrder`: write `void` rows that restore the stock.
- Admin "Stock" page: receive goods, make adjustments with a reason, do a stock count (enter actual quantities and post the differences), and see a low-stock list.

### 1.4 Loyalty by spend (D4)
- `shops.stamp_mode` (`per_item | per_amount`) and `shops.stamp_per_satang`. Checkout calculates stamps from the order total in `per_amount` mode.

### 1.5 Reports
- Add stock value (at cost), low-stock items, top SKUs, and margin when a cost is set. Add stock movements to the CSV export.

**Verify:** integration tests (following the `orders.int.test.ts` pattern) cover:
- Checkout decrements stock, and voiding restores it.
- Two concurrent checkouts of the last unit behave according to D2.
- Barcode lookup is scoped by shop.
- CSV import upserts by SKU and rejects duplicate barcodes.
- `per_amount` stamp maths.

---

## Phase 2: Restaurant, ~4–5 weeks

The goal is a restaurant that opens a bill per table, adds rounds of dishes, sends them to the kitchen and takes payment at the end, including split bills.

### 2.1 Tables
- New `dining_tables` table (`id, shop_id, name, zone, sort, is_active`). Add `orders.table_id`, `orders.order_type` (`dine_in | takeaway`) and `orders.covers`.
- Admin: CRUD for tables and zones.
- POS: a `/pos/tables` floor screen showing each table as free or occupied, with its running total and elapsed time.

### 2.2 Open bills (the biggest change)
Today `checkout` creates and pays an order in one transaction. The `open` status exists but nothing uses it.
- Move pricing out of `checkout` into a shared function (`priceLines`).
- New endpoints:
  - `POST /orders` opens an order (status `open`, assigns `daily_no`, sets the business date at open time).
  - `POST /orders/:id/items` adds a round.
  - `DELETE /orders/:id/items/:itemId` removes an item. A manager PIN is required once the item has been sent to the kitchen.
  - `POST /orders/:id/pay`.
- The existing `checkout` becomes "open and pay in one step", so the café and retail flows don't change.
- Concurrency: add an `orders.version` column for optimistic locking, so two tablets editing the same table get a clear conflict. The floor screen polls every 5 seconds; PostgreSQL notifications or a managed realtime service can come later.
- Cancelling an open bill uses the void path, with a manager PIN. Reports already count only `paid` orders.

### 2.3 Kitchen (D3)
- `order_items.sent_at` and `order_items.kitchen_status` (`new | preparing | ready | served`). Add an optional `products.station` (`kitchen | bar`).
- "Send to kitchen" prints a kitchen ticket containing only the unsent items, grouped by station. It reuses the 58 mm receipt route with a ticket view.
- Later: a `/kds` screen on a paired device that shows and advances `kitchen_status`.

### 2.4 Paying the bill
- `shops.service_charge_bps` and `orders.service_charge_satang` (for example 10%), shown on the receipt.
- Split bill by amount: the `payments` table already allows several rows per order, and the order is paid once their sum reaches the total. Split by item comes later.
- Move a bill to another table, or merge two tables.

**Verify:** integration tests cover:
- An open → add → add → pay flow totals correctly.
- A stale `version` is rejected.
- Removing an item after sending requires a manager PIN.
- A split payment marks the order paid only once the total is covered.
- Open orders don't appear in reports.
- Kitchen tickets contain only unsent items.

---

## Cross-cutting rules for every phase

- Each schema change: update `backend/src/db/schema.ts`, run `pnpm db:generate` to create the migration, and add any `ALTER TYPE` by hand where Drizzle can't generate it.
- After each API change, regenerate `backend/openapi.json` (`pnpm --filter backend openapi:generate`).
- Before each merge: Biome, `typecheck` for both packages, backend tests and the frontend Vitest and integration suites.
- Update the README features list and screenshots for each business type when its phase ships.

## Out of scope (separate decisions)

- **VAT and full tax invoices (ใบกำกับภาษี).** Many retail and restaurant SMEs are VAT-registered, and supporting them needs Revenue Department POS approval. This is the largest remaining barrier for the template.
- Offline mode. Restaurants and retail feel connection drops more than cafés do.
- Multiple branches per owner (a level above `shops`).
- Product variants (D1), sale by weight (D5), payment gateways, delivery-platform integration (Grab, LINE MAN), and service businesses with appointments.

## Milestones (at about 8 hours a week)

| Weeks | Deliverable | Done when |
|---|---|---|
| 1–2 | Phase 0 | A new shop of each type onboards with the right preset; café regression tests pass |
| 3–6 | Phase 1 | A pilot minimart imports 300 SKUs from CSV, sells by barcode, and its stock count matches |
| 7–11 | Phase 2 | A pilot restaurant runs one dinner service on open bills and kitchen tickets with no lost items |
