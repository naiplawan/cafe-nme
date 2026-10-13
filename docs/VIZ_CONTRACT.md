# Visualization contract (charts in admin + POS)

GSAP-animated SVG charts, no chart library. Read `docs/MOTION.md` first — its rules apply
(import GSAP only from `@/components/motion/gsap`, `useGSAP` with scope, reduced motion via
`gsap.matchMedia()`, transforms/opacity/DrawSVG only, never block input).

## Phase 1a — chart kit: `src/components/charts/` (client components, `"use client"`)

Props must be serializable — server pages render these directly, so **no function props**.
Number formatting is chosen with `format`:

```ts
export type ChartFormat = "baht" | "number" | "percent"; // "baht" values are integer satang → formatBaht
export type ChartDatum = { label: string; value: number };

<BarChart data={ChartDatum[]} format? ariaLabel height?={160} highlightLast?={false} />
//   vertical bars; bars grow with scaleY from the baseline (transformOrigin bottom, stagger 0.03);
//   value shown on hover/focus via <title> and in the sr-only table; x labels under bars (thin them out
//   automatically when > 12 bars).
<AreaChart data={ChartDatum[]} format? ariaLabel height?={180} />
//   line drawn with drawSVG 0%→100% + area fading in + end dots popping; y gridlines (3) with labels.
//   Use a viewBox in real pixels measured by ResizeObserver (do NOT use preserveAspectRatio="none" or
//   vector-effect: non-scaling-stroke — DrawSVG mis-measures those, see MOTION.md bug list).
<DonutChart data={(ChartDatum & { color?: string })[]} format? ariaLabel size?={160}
            centerLabel? centerValue? />
//   segments drawn one after another with drawSVG; legend beside/below with value + percent.
<HBarList data={ChartDatum[]} format? ariaLabel limit?={5} />
//   ranked horizontal bars (rank number, label, bar scaling from left with scaleX, value at right).
<Sparkline values={number[]} ariaLabel width?={120} height?={32} />
<CountUp value={number} format? className? />   // number counts up from 0 (≤ 0.6 s); text is final value for SSR/no-JS
<ChartCard title subtitle? action?={ReactNode} children />  // card shell matching admin Card styling
```

Shared rules for every chart:
- `role="img"` + `aria-label`, plus a visually hidden `<table>`/`<ul>` listing every label/value (screen readers).
- Empty or all-zero data → a calm empty state "ยังไม่มีข้อมูลในช่วงนี้" (no broken axes).
- Palette: espresso `#3B2A20`, latte `#C69C72`, terracotta `#B4441C`, sage `#2F6B3F`, cream grid `#EADBC8`.
  Default series colour = terracotta; donut default colours in that order.
- Animate on mount and when `data` changes (`dependencies: [JSON.stringify(data)]`); with reduced motion,
  render final state immediately. Durations: admin ≤ 0.8 s total, POS ≤ 0.3 s.
- Responsive: fill container width; no horizontal page scroll at 360 px.
- Thai labels; numbers `tabular-nums`.
- Export everything from `src/components/charts/index.ts`.

## Phase 1b — data: `src/server/reports.ts` additions (server-only, scoped by shopId, paid orders only)

```ts
export async function hourlySales(shopId, from, to): Promise<{ hour: number; orders: number; netSatang: number }[]>;
//   24 entries (0–23) always, zero-filled; hour of paid_at in Asia/Bangkok.
export async function categorySales(shopId, from, to): Promise<{ category: string; qty: number; revenueSatang: number }[]>;
//   via order_items.product_id → products.category_id → categories; null/deleted → "อื่นๆ"; sorted by revenue desc.
export async function memberGrowth(shopId, from, to): Promise<{ date: string; newMembers: number; totalMembers: number }[]>;
//   one entry per day in range (zero-filled), totalMembers cumulative incl. members created before `from`;
//   excludes deleted members; dates are Bangkok business dates.
export async function memberOverview(shopId): Promise<{ total: number; lineLinked: number; active30d: number; rewardsAvailable: number }>;
//   active30d = members with a paid order in the last 30 days.
```
Existing and reusable: `salesSummary` (incl. `byMethod`), `salesByItem`, `dailySales` (sparse — zero-fill in UI).

Plus `scripts/seed-sales.ts` + package script `db:seed-sales`: generates ~30 days of realistic paid orders for
the `demo-cafe` shop (7:00–18:00, morning + lunch peaks, 20–60 orders/day, 1–3 items each from active products
with their prices, ~70% cash / 30% PromptPay, ~35% attached to existing members with stamp_ledger earn rows,
a few voids). Must keep `daily_no` sequential per business date after any existing orders, set `paid_at`,
`payments`, `order_items` (`name_snapshot`, `unit_price_satang`). Idempotent marker: skip if it already ran
(e.g. orders tagged by a note or a check for > 100 orders). Local demo only.
