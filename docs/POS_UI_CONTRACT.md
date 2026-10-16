# POS UI contract (wave 2)

The POS is built to match the design in `docs/design/pos/*.dc.html` (Main = sales screen with all
overlays, Login = staff + PIN, Orders = today's orders + void). Those files are a prototype format:
read the markup and inline styles for layout, sizes, colors and copy; ignore the `DCLogic` script
mechanics. Image URLs `/_blob/...` map to the app's assets:
logo `/assets/logo-mark.png`, stamp on/off `/assets/stamp-filled.png` / `/assets/stamp-empty.png`,
reward `/assets/reward-free-drink.png`, product images come from the product's `imageUrl`.

Design tokens (use Tailwind arbitrary values, e.g. `bg-[#3B2A20]`):
espresso #3B2A20 · header chip #574235 · cream bg #F5EDE3 · surface #FFFBF6 · rail #EFE3D5 ·
line #E4D6C6 / #D9C5B0 · muted text #6B5547 · pay terracotta #B4441C · success #2F6B3F (bg #E7F1E8, text #245232) ·
error text #8E3415 (bg #F7DCD0) · disabled #C9B6A4 · LINE green #06C755 · overlay rgba(43,30,22,0.55).
Font is already Noto Sans Thai (root layout). Target: landscape tablet 1280×800, must also work at
1024×768 and larger; touch targets ≥ 44 px, primary actions 64–84 px tall. No hover-only affordances.

Shared, already written: `frontend/src/app/pos/_components/keypad.tsx` → `<Keypad value onChange maxLength clearLabel? keyClassName? className? />`.
Pure helpers usable in client components: `priceCart`, `rewardDiscount`, `stampsForLines` (`@/lib/pricing`), `formatBaht` (`@/lib/money`).
Server: `requirePosStaff()` (`@/server/pos-session`), `getPosMenu` (`@/server/catalog`), `checkout`, `getOrder`,
`listOrdersForDay`, `voidOrder` (`@/server/orders`), `getMemberSummary` (`@/server/loyalty`),
`findMemberByToken`, `findMembersByPhone` (`@/server/members`), `verifyManagerPin` (`@/server/pos-session`),
`pushText` (`@/server/line`), `businessDate` (`@/lib/business-date`). See docs/CONTRACTS.md for signatures.

## Ownership and interfaces

### Worker `sale` — sales screen
Owns: `frontend/src/app/pos/layout.tsx`, `frontend/src/app/pos/page.tsx`, `frontend/src/app/pos/actions.ts`,
`frontend/src/app/pos/_components/{pos-app,pos-header,category-rail,product-grid,modifier-sheet,cart-panel,member-panel,scan-dialog,phone-dialog}.tsx`.

```ts
// frontend/src/app/pos/actions.ts ("use server"; every action calls requirePosStaff() and uses its shopId)
export async function lookupMemberByQr(token: string): Promise<MemberSummary | null>;
export async function searchMembersByPhone(query: string): Promise<MemberSummary[]>; // ≥ 4 digits, max 5
```
`page.tsx` (server, `export const instant = false`): `requirePosStaff()`, `getPosMenu(shopId)`, next order number =
(max dailyNo today from listOrdersForDay) + 1, then renders `<PosApp …/>`. `layout.tsx` only sets the cream
full-screen background (`min-h-dvh`), no header (each page draws its own header per the design).

`PosApp` owns the cart state and renders the payment and done screens from worker `pay`:
```tsx
<PaymentDialog
  orderLabel="#024"
  lines={[{ key, name, qty, modifiersText, lineTotalSatang }]}
  subtotalSatang discountSatang totalSatang
  checkoutInput={{ lines: CartLineInput[], memberId, redeemRewardId }}
  promptpayEnabled={!!shop.promptpayId}
  onClose={() => …}
  onPaid={(result: CheckoutResult, method: "cash" | "promptpay") => …}
/>
<DoneScreen result={CheckoutResult} method="cash" | "promptpay" onNewOrder={() => …} />
```
After `onNewOrder` the cart, member and reward toggle reset and the order number advances (`result.dailyNo + 1`).

### Worker `pay` — payment and done
Owns: `frontend/src/app/pos/checkout-actions.ts`, `frontend/src/app/pos/_components/{payment-dialog,done-screen,promptpay-qr}.tsx`.

```ts
// frontend/src/app/pos/checkout-actions.ts ("use server"; requirePosStaff() for shopId + staffId)
export type CheckoutActionResult = { ok: true; result: CheckoutResult } | { ok: false; message: string }; // Thai message per CheckoutError code
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutActionResult>;
export async function promptPayQr(amountSatang: number): Promise<{ svg: string } | { error: string }>; // promptpay-qr payload → qrcode SVG string, uses shop.promptpayId
export async function sendReceiptToLine(orderId: string): Promise<{ ok: boolean; message: string }>; // member must have lineUserId; pushText with a short Thai receipt
```
`PaymentDialog` and `DoneScreen` props exactly as above (export both as named exports).

### Worker `orders` — orders, receipt, login/pair restyle
Owns: `frontend/src/app/pos/orders/**`, `frontend/src/app/pos/receipt/**`, `frontend/src/app/pos/login/**`, `frontend/src/app/pos/pair/**`.
- `/pos/orders`: per Orders.dc.html; void needs manager PIN via `verifyManagerPin`, then `voidOrder`.
- `/pos/receipt/[orderId]`: printable 58 mm receipt (`@page { size: 58mm auto; margin: 0 }`), auto-calls `window.print()`
  once on load, a "กลับ" link for screen view. Shows shop name, order no, date/time (Bangkok), items with modifiers,
  discount, total, payment method, cash received/change, receipt footer, "ไม่ใช่ใบกำกับภาษี".
- Restyle `/pos/login` (Login.dc.html) and `/pos/pair` (same visual language) keeping their existing server actions working.
