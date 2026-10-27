// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ getPosDeviceId: vi.fn(), getOrderAction: vi.fn(), voidOrderAction: vi.fn(), searchMembersByPhone: vi.fn(), quoteCheckoutAction: vi.fn(), reservePromptPayStockAction: vi.fn(), releasePromptPayStockAction: vi.fn(), checkoutAction: vi.fn(), loadQueueAction: vi.fn(), advancePreparationAction: vi.fn(), remakeDrinkAction: vi.fn(), loadRequestsAction: vi.fn(), decideRequestAction: vi.fn(), openShiftAction: vi.fn(), closeShiftAction: vi.fn(), cashMovementAction: vi.fn() }));
vi.mock("./orders/actions", () => actions);
vi.mock("./queue/actions", () => actions);
vi.mock("./requests/actions", () => actions);
vi.mock("./shifts/actions", () => actions);
vi.mock("./actions", () => actions);
vi.mock("./checkout-actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement("img", props) }));
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props) }));
vi.mock("@/components/motion/gsap", () => ({ useGSAP: () => ({ contextSafe: (fn: unknown) => fn }), prefersReducedMotion: () => true, gsap: {}, MOTION: {} }));
vi.mock("./_components/promptpay-qr", () => ({ PromptPayQr: ({ amountSatang }: { amountSatang: number }) => React.createElement("div", { "data-testid": "qr" }, amountSatang) }));
import { OrdersScreen } from "./orders/orders-screen";
import { PhoneDialog } from "./_components/phone-dialog";
import { PaymentDialog } from "./_components/payment-dialog";
import type { OrderDetail } from "@/server/orders";

function detail(id: string, dailyNo: number): OrderDetail {
  return { id, dailyNo, status: "paid", totalSatang: 5050, paymentMethod: "cash", memberName: null, staffName: "Staff", itemCount: 1, paidAt: new Date(), subtotalSatang: 5050, discountSatang: 0, cashReceivedSatang: 5050, items: [{ id: `item-${id}`, name: `Coffee ${dailyNo}`, qty: 1, unitPriceSatang: 5050, note: null, modifiers: [] }], voidedAt: null, businessDate: "2026-10-22", shopName: "Cafe", receiptFooter: null };
}
const first = detail("first", 1), second = detail("second", 2);
function renderOrders(initialDetail: OrderDetail = first) {
  return render(React.createElement(OrdersScreen, { orders: [first, second], initialDetail, netSalesSatang: 10100, todaySummary: { orders: 2, netSatang: 10100, cups: 2, byMethod: { cash: 10100, promptpay: 0 } }, hourlySales: [], topItems: [], currentHour: 12 }));
}
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, action: () => unknown) => action() } }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("ignores stale order responses and removes actions while details load", async () => {
  let resolveFirst!: (value: OrderDetail) => void;
  let resolveSecond!: (value: OrderDetail) => void;
  actions.getOrderAction.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; })).mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
  renderOrders();
  fireEvent.click(screen.getByRole("button", { name: /#002/ }));
  expect(screen.queryByRole("link", { name: /พิมพ์ใบเสร็จซ้ำ/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /#001/ }));
  await act(async () => resolveSecond(first));
  await act(async () => resolveFirst(second));
  expect(screen.getByText("Coffee 1")).toBeTruthy();
  expect(screen.queryByText("Coffee 2")).toBeNull();
  expect(screen.getByRole("link", { name: /พิมพ์ใบเสร็จซ้ำ/ }).getAttribute("href")).toBe("/pos/receipt/first");
});
it("releases cancellation controls after a transport error", async () => {
  actions.voidOrderAction.mockRejectedValue(new Error("offline"));
  renderOrders({ ...first, status: "open" });
  fireEvent.click(screen.getByRole("button", { name: "ยกเลิกบิลนี้" }));
  for (const number of ["1", "2", "3", "4"]) fireEvent.click(screen.getByRole("button", { name: number }));
  fireEvent.click(screen.getByRole("button", { name: /ยืนยันยกเลิก/ }));
  await waitFor(() => expect(screen.getByText(/ยังยืนยันผลการยกเลิกไม่ได้/)).toBeTruthy());
  expect(screen.getByRole("button", { name: "ไม่ยกเลิก" }).hasAttribute("disabled")).toBe(false);
});
it("separates failed phone search from no matches and supports retry", async () => {
  actions.searchMembersByPhone.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
  render(React.createElement(PhoneDialog, { onAttach: vi.fn(), onClose: vi.fn() }));
  for (const number of ["0", "8", "1", "2"]) fireEvent.click(screen.getByRole("button", { name: number }));
  await screen.findByRole("alert");
  expect(screen.queryByText("ไม่พบสมาชิก")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
  await screen.findByText("ไม่พบสมาชิก");
});
it("withholds QR until a changed quote is accepted and submits exact satang", async () => {
  const line = { key: "coffee", name: "Coffee", qty: 1, modifiersText: "", lineTotalSatang: 5000 };
  actions.quoteCheckoutAction.mockResolvedValue({ ok: true, quote: { lines: [{ ...line, lineTotalSatang: 5050 }], subtotalSatang: 5050, discountSatang: 0, totalSatang: 5050 } });
  actions.reservePromptPayStockAction.mockResolvedValue({ ok: true, reservation: { expiresAt: new Date(Date.now() + 1800000) } });
  actions.checkoutAction.mockResolvedValue({ ok: true, result: { orderId: "paid" } });
  const onPaid = vi.fn();
  render(React.createElement(PaymentDialog, { orderLabel: "#001", lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 1, modifierIds: [] }] }, cartStorageKey: "cart", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, promptpayEnabled: true, shopName: "Cafe", onClose: vi.fn(), onPaid }));
  await screen.findByRole("button", { name: "ยืนยันยอดใหม่" });
  expect(screen.getByRole("tab", { name: "พร้อมเพย์" }).closest("fieldset")?.disabled).toBe(true);
  expect(screen.queryByTestId("qr")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันยอดใหม่" }));
  fireEvent.click(screen.getByRole("tab", { name: "พร้อมเพย์" }));
  await waitFor(() => expect(actions.reservePromptPayStockAction).toHaveBeenCalledWith(expect.objectContaining({ expectedTotalSatang: 5050, payment: { method: "promptpay" } })));
  expect(await screen.findByTestId("qr")).toBeTruthy();
  expect(screen.getByTestId("qr").textContent).toBe("5050");
  fireEvent.click(screen.getByRole("tab", { name: "เงินสด" }));
  expect(actions.releasePromptPayStockAction).toHaveBeenCalledWith(actions.reservePromptPayStockAction.mock.calls[0][0].requestId);
  fireEvent.click(screen.getByRole("button", { name: "พอดี" }));
  fireEvent.click(screen.getByRole("button", { name: /รับเงิน · ทอน/ }));
  await waitFor(() => expect(onPaid).toHaveBeenCalled());
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ expectedTotalSatang: 5050, payment: { method: "cash", cashReceivedSatang: 5050 } }));
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ requestId: actions.reservePromptPayStockAction.mock.calls[0][0].requestId }));
});

it("releases the PromptPay stock hold when the dialog closes without payment", async () => {
  const line = { key: "coffee", name: "Coffee", qty: 1, modifiersText: "", lineTotalSatang: 5000 };
  actions.quoteCheckoutAction.mockResolvedValue({ ok: true, quote: { lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000 } });
  actions.reservePromptPayStockAction.mockResolvedValue({ ok: true, reservation: { expiresAt: new Date(Date.now() + 1800000) } });
  const onClose = vi.fn();
  render(React.createElement(PaymentDialog, { orderLabel: "#001", lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 1, modifierIds: [] }] }, cartStorageKey: "cart", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, promptpayEnabled: true, shopName: "Cafe", onClose, onPaid: vi.fn() }));
  await screen.findByRole("tab", { name: "พร้อมเพย์" });
  fireEvent.click(screen.getByRole("tab", { name: "พร้อมเพย์" }));
  await screen.findByTestId("qr");
  fireEvent.click(screen.getByRole("button", { name: "กลับ" }));
  expect(onClose).toHaveBeenCalled();
  expect(actions.releasePromptPayStockAction).toHaveBeenCalledWith(actions.reservePromptPayStockAction.mock.calls[0][0].requestId);
});

it("releases the PromptPay stock hold when the cart changes while the QR is open", async () => {
  const line = { key: "coffee", name: "Coffee", qty: 1, modifiersText: "", lineTotalSatang: 5000 };
  actions.quoteCheckoutAction.mockResolvedValue({ ok: true, quote: { lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000 } });
  actions.reservePromptPayStockAction.mockResolvedValue({ ok: true, reservation: { expiresAt: new Date(Date.now() + 1800000) } });
  const props = { orderLabel: "#001", lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 1, modifierIds: [] }] }, cartStorageKey: "cart", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, promptpayEnabled: true, shopName: "Cafe", onClose: vi.fn(), onPaid: vi.fn() };
  const { rerender } = render(React.createElement(PaymentDialog, props));
  await screen.findByRole("tab", { name: "พร้อมเพย์" });
  fireEvent.click(screen.getByRole("tab", { name: "พร้อมเพย์" }));
  await screen.findByTestId("qr");
  rerender(React.createElement(PaymentDialog, { ...props, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 2, modifierIds: [] }] } }));
  expect(actions.releasePromptPayStockAction).toHaveBeenCalledWith(actions.reservePromptPayStockAction.mock.calls[0][0].requestId);
});

it("does not display a PromptPay QR or accept confirmation when stock cannot be reserved", async () => {
  const line = { key: "coffee", name: "Coffee", qty: 1, modifiersText: "", lineTotalSatang: 5000 };
  actions.quoteCheckoutAction.mockResolvedValue({ ok: true, quote: { lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000 } });
  actions.reservePromptPayStockAction.mockResolvedValue({ ok: false, message: "วัตถุดิบในสูตรไม่พอ" });
  render(React.createElement(PaymentDialog, { orderLabel: "#001", lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 1, modifierIds: [] }] }, cartStorageKey: "cart", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, promptpayEnabled: true, shopName: "Cafe", onClose: vi.fn(), onPaid: vi.fn() }));
  await screen.findByRole("tab", { name: "พร้อมเพย์" });
  fireEvent.click(screen.getByRole("tab", { name: "พร้อมเพย์" }));
  await screen.findByRole("alert");
  expect(screen.queryByTestId("qr")).toBeNull();
  expect(screen.getAllByText("วัตถุดิบในสูตรไม่พอ")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "ได้รับเงินแล้ว" }).hasAttribute("disabled")).toBe(true);
  expect(actions.checkoutAction).not.toHaveBeenCalled();
});

it("recovers a durable checkout through the recovery screen after tab storage is lost", async () => {
  const { submitBrowserCheckout, resolveBrowserCheckout } = await import("@/lib/browser-checkout");
  const { CheckoutRecovery } = await import("./_components/checkout-recovery");
  const pending = { requestId: "66666666-6666-4666-8666-666666666666", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, lines: [{ productId: "coffee", qty: 1, modifierIds: [] }], payment: { method: "promptpay" as const } };
  const key = "cafe-pos-cart:device:staff";
  await submitBrowserCheckout(pending, key, async () => { throw new Error("response lost"); });
  sessionStorage.clear();
  const restored = await resolveBrowserCheckout(key);
  expect(restored.input).toEqual(pending);
  if (!restored.input) throw new Error("Missing recovery");
  actions.checkoutAction.mockResolvedValue({ ok: true, result: { orderId: "paid", dailyNo: 1, subtotalSatang: 5050, discountSatang: 0, totalSatang: 5050, changeSatang: 0, stampsEarned: 0, rewardsCreated: 0, member: null, replayed: true } });
  let recoveredOrder = "";
  render(React.createElement(CheckoutRecovery, { pending: restored.input, cartStorageKey: restored.cartStorageKey, onRecovered: (result) => { recoveredOrder = result.orderId; }, onRejected: () => { throw new Error("Rejected a committed checkout"); } }));
  fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบรายการเดิมอีกครั้ง" }));
  await waitFor(() => expect(recoveredOrder).toBe("paid"));
  expect(actions.checkoutAction).toHaveBeenCalledWith(pending);
  expect((await resolveBrowserCheckout(key)).input).toBeNull();
});

const sourceMenu = { categories: [], products: [{ id: "77777777-7777-4777-8777-777777777777", name: "Source Coffee", categoryId: null, basePriceSatang: 5000, imageUrl: null, earnsStamp: true, soldOut: false, groups: [] }] };
const sourceDraft = { id: "88888888-8888-4888-8888-888888888888", totalSatang: 10000, lines: [{ productId: sourceMenu.products[0].id, qty: 2, modifierIds: [] }] };
const posProps = { shop: { id: "shop", name: "Cafe", promptpayId: null, stampGoal: 10, receiptFooter: null }, staff: { id: "staff", name: "Staff", role: "barista" as const }, menu: sourceMenu, orderNo: 1, logoUrl: null, acceptedSelfOrder: sourceDraft };
it("imports an accepted draft into an empty cart and retains its source across reload", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  const first = render(React.createElement(PosApp, posProps));
  await screen.findByText("รายการจาก QR · รับชำระเงิน");
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("cafe-pos-cart:device:staff") ?? "{}").selfOrderId).toBe(sourceDraft.id));
  first.unmount();
  render(React.createElement(PosApp, { ...posProps, acceptedSelfOrder: null }));
  expect(await screen.findByText("รายการจาก QR · รับชำระเงิน")).toBeTruthy();
});
it("never replaces an existing cart when opening a self-order link", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  sessionStorage.setItem("cafe-pos-cart:device:staff", JSON.stringify({ lines: [{ ...sourceDraft.lines[0], qty: 1 }], memberId: null, redeemRewardId: null }));
  render(React.createElement(PosApp, posProps));
  await waitFor(() => expect(screen.queryByText("กำลังโหลดออเดอร์…")).toBeNull());
  expect(screen.queryByText("รายการจาก QR · รับชำระเงิน")).toBeNull();
  expect(JSON.parse(sessionStorage.getItem("cafe-pos-cart:device:staff") ?? "{}").lines[0].qty).toBe(1);
});
it("shows uncertain checkout recovery before importing a different accepted draft", async () => {
  const { PosApp } = await import("./_components/pos-app");
  const { submitBrowserCheckout } = await import("@/lib/browser-checkout");
  actions.getPosDeviceId.mockResolvedValue("device");
  await submitBrowserCheckout({ requestId: "66666666-6666-4666-8666-666666666666", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, lines: [{ ...sourceDraft.lines[0], qty: 1 }], payment: { method: "promptpay" } }, "cafe-pos-cart:device:staff", async () => { throw new Error("unknown"); });
  render(React.createElement(PosApp, posProps));
  expect(await screen.findByText("พบรายการชำระเงินที่ยังไม่ยืนยัน")).toBeTruthy();
  expect(screen.queryByText("รายการจาก QR · รับชำระเงิน")).toBeNull();
});
it("carries the accepted draft identity through normal cashier payment", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  actions.quoteCheckoutAction.mockResolvedValue({ ok: true, quote: { lines: [{ name: "Source Coffee", qty: 2, modifiersText: "", lineTotalSatang: 10000 }], subtotalSatang: 10000, discountSatang: 0, totalSatang: 10000 } });
  actions.checkoutAction.mockResolvedValue({ ok: true, result: { orderId: "paid", dailyNo: 1, subtotalSatang: 10000, discountSatang: 0, totalSatang: 10000, changeSatang: 0, stampsEarned: 0, rewardsCreated: 0, member: null } });
  render(React.createElement(PosApp, posProps));
  fireEvent.click(await screen.findByRole("button", { name: "ตรวจสอบยอดและรับชำระเงิน" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "พอดี" }).closest("fieldset")?.disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "พอดี" }));
  fireEvent.click(screen.getByRole("button", { name: /รับเงิน · ทอน/ }));
  expect(await screen.findByText("ชำระเงินเรียบร้อย · ออเดอร์")).toBeTruthy();
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ selfOrderId: sourceDraft.id, lines: sourceDraft.lines, expectedTotalSatang: 10000 }));
});


it("keeps queue actions available during polling and ignores the stale poll after a tap", async () => {
  const { QueueScreen } = await import("./queue/queue-screen");
  const row = { id: "order", dailyNo: 1, status: "received" as const, updatedAt: null, items: [] };
  let finishPoll!: (value: unknown) => void;
  actions.loadQueueAction.mockReturnValue(new Promise(resolve => { finishPoll = resolve; }));
  actions.advancePreparationAction.mockResolvedValue({ ok: true, update: { id: row.id, status: "preparing", updatedAt: null } });
  vi.useFakeTimers();
  render(React.createElement(QueueScreen, { initial: [row] }));
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole("button", { name: "เริ่มทำ" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "รีเฟรชคิว" }).hasAttribute("disabled")).toBe(false);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "เริ่มทำ" })); });
  await act(async () => { finishPoll({ ok: true, rows: [row] }); });
  expect(screen.getByRole("button", { name: "พร้อมเสิร์ฟ" })).toBeTruthy();
});

it("polls QR requests quietly and confirms rejection before sending it", async () => {
  const { RequestsScreen } = await import("./requests/requests-screen");
  const order = { id: "request", status: "pending" as const, totalSatang: 5050, dailyNo: null, mode: "pickup" as const, tableLabel: null, items: [] };
  let finishPoll!: (value: unknown) => void;
  actions.loadRequestsAction.mockReturnValue(new Promise(resolve => { finishPoll = resolve; }));
  actions.decideRequestAction.mockResolvedValue({ ok: true, order: { ...order, status: "rejected" } });
  vi.useFakeTimers();
  render(React.createElement(RequestsScreen, { initial: [order] }));
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(actions.loadRequestsAction).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "รับรายการ" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "ไม่รับรายการ" }));
  expect(actions.decideRequestAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "กลับ" }));
  expect(actions.decideRequestAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "ไม่รับรายการ" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ยืนยันไม่รับรายการ" })); });
  await act(async () => { finishPoll({ ok: true, orders: [order] }); });
  expect(screen.getByText("ไม่มีรายการรอรับ")).toBeTruthy();
});

it("pauses QR polling while hidden or offline and resumes on return", async () => {
  const { RequestsScreen } = await import("./requests/requests-screen");
  actions.loadRequestsAction.mockResolvedValue({ ok: true, orders: [] });
  vi.useFakeTimers();
  render(React.createElement(RequestsScreen, { initial: [] }));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(actions.loadRequestsAction).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(actions.loadRequestsAction).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(actions.loadRequestsAction).toHaveBeenCalledTimes(1);
});

it("blocks payment when the cart contains a sold-out product", async () => {
  const { CartPanel } = await import("./_components/cart-panel");
  const { priceCart } = await import("@/lib/pricing");
  const lines = [sourceDraft.lines[0]];
  const menu = { ...sourceMenu, products: [{ ...sourceMenu.products[0], soldOut: true }] };
  render(React.createElement(CartPanel, { lines, pricedLines: priceCart(lines, menu).lines, subtotalSatang: 10000, discountSatang: 0, totalSatang: 10000, menu, member: null, redeemRewardId: null, online: true, onQuantity: vi.fn(), onEdit: vi.fn(), onScan: vi.fn(), onPhone: vi.fn(), onRemoveMember: vi.fn(), onToggleReward: vi.fn(), onPay: vi.fn() }));
  expect(screen.getByRole("button", { name: /นำรายการที่หมดออกก่อนชำระเงิน/ }).hasAttribute("disabled")).toBe(true);
});

it("restores a removed last unit without replacing subsequent cart additions", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  sessionStorage.setItem("cafe-pos-cart:device:staff", JSON.stringify({ lines: [{ ...sourceDraft.lines[0], qty: 1 }], memberId: null, redeemRewardId: null }));
  render(React.createElement(PosApp, { ...posProps, acceptedSelfOrder: null }));
  fireEvent.click(await screen.findByRole("button", { name: "ลดจำนวน Source Coffee" }));
  const undo = await screen.findByRole("button", { name: "เลิกทำ" });
  fireEvent.click(screen.getByRole("button", { name: /Source Coffee.*50/ }));
  fireEvent.click(undo);
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("cafe-pos-cart:device:staff") ?? "{}").lines[0].qty).toBe(2));
});

it("shows shift guidance without blocking PromptPay checkout", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  render(React.createElement(PosApp, { ...posProps, cashShiftOpen: false }));
  expect(await screen.findByRole("link", { name: "เปิดกะเงินสด" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "ตรวจสอบยอดและรับชำระเงิน" }).hasAttribute("disabled")).toBe(false);
});

it("enters a shift amount with the touch keypad and submits its named field", async () => {
  const { ShiftForm } = await import("./shifts/shift-form");
  actions.openShiftAction.mockImplementation(async (_previous, form: FormData) => ({ ok: true, message: `saved ${form.get("amount")}` }));
  render(React.createElement(ShiftForm, { requestId: "request", recipients: [] }));
  for (const digit of ["5", "0", ".", "5"]) fireEvent.click(screen.getByRole("button", { name: digit }));
  const input = screen.getByLabelText("เงินทอนเริ่มต้น (บาท)") as HTMLInputElement;
  expect(input.inputMode).toBe("none");
  expect(input.value).toBe("50.5");
  fireEvent.click(screen.getByRole("button", { name: "เปิดกะเงินสด" }));
  expect(await screen.findByText("saved 50.5")).toBeTruthy();
});

it("prevents empty or excessive shift amounts while retaining the existing maximum", async () => {
  const { ShiftForm } = await import("./shifts/shift-form");
  render(React.createElement(ShiftForm, { requestId: "request", recipients: [] }));
  const submit = screen.getByRole("button", { name: "เปิดกะเงินสด" });
  expect(submit.hasAttribute("disabled")).toBe(true);
  for (const digit of "21474836.47") fireEvent.click(screen.getByRole("button", { name: digit }));
  expect((screen.getByLabelText("เงินทอนเริ่มต้น (บาท)") as HTMLInputElement).value).toBe("21474836.47");
  expect(submit.hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "ลบ" }));
  fireEvent.click(screen.getByRole("button", { name: "8" }));
  expect(submit.hasAttribute("disabled")).toBe(true);
});

it("retains hardware-keyboard entry for shift amounts without requesting a touch keyboard", async () => {
  const { ShiftForm } = await import("./shifts/shift-form");
  render(React.createElement(ShiftForm, { requestId: "request", recipients: [] }));
  const input = screen.getByLabelText("เงินทอนเริ่มต้น (บาท)") as HTMLInputElement;
  expect(input.readOnly).toBe(false);
  fireEvent.change(input, { target: { value: "100.25" } });
  expect(input.value).toBe("100.25");
  expect(screen.getByRole("button", { name: "เปิดกะเงินสด" }).hasAttribute("disabled")).toBe(false);
});

it("keeps a failed QR decision visible after a successful background refresh", async () => {
  const { RequestsScreen } = await import("./requests/requests-screen");
  const order = { id: "request", status: "pending" as const, totalSatang: 5050, dailyNo: null, mode: "pickup" as const, tableLabel: null, items: [] };
  actions.decideRequestAction.mockResolvedValue({ ok: false, message: "รับรายการไม่สำเร็จ" });
  actions.loadRequestsAction.mockResolvedValue({ ok: true, orders: [order] });
  vi.useFakeTimers();
  render(React.createElement(RequestsScreen, { initial: [order] }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "รับรายการ" })); });
  expect(screen.getByRole("alert").textContent).toBe("รับรายการไม่สำเร็จ");
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole("alert").textContent).toBe("รับรายการไม่สำเร็จ");
});

it("shows unavailable QR pricing without presenting a zero-baht total", async () => {
  const { PosApp } = await import("./_components/pos-app");
  actions.getPosDeviceId.mockResolvedValue("device");
  render(React.createElement(PosApp, { ...posProps, menu: { categories: [], products: [] } }));
  await screen.findByText("รายการจาก QR · รับชำระเงิน");
  expect(screen.getByText("รอตรวจสอบราคา")).toBeTruthy();
  expect(screen.queryByText("฿0")).toBeNull();
});
