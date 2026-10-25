// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ getPosDeviceId: vi.fn(), getOrderAction: vi.fn(), voidOrderAction: vi.fn(), searchMembersByPhone: vi.fn(), quoteCheckoutAction: vi.fn(), reservePromptPayStockAction: vi.fn(), checkoutAction: vi.fn() }));
vi.mock("./orders/actions", () => actions);
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
function renderOrders() {
  return render(React.createElement(OrdersScreen, { orders: [first, second], initialDetail: first, netSalesSatang: 10100, todaySummary: { orders: 2, netSatang: 10100, cups: 2, byMethod: { cash: 10100, promptpay: 0 } }, hourlySales: [], topItems: [], currentHour: 12 }));
}
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, action: () => unknown) => action() } }); });
afterEach(cleanup);
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
  renderOrders();
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
  fireEvent.click(screen.getByRole("button", { name: "พอดี" }));
  fireEvent.click(screen.getByRole("button", { name: /รับเงิน · ทอน/ }));
  await waitFor(() => expect(onPaid).toHaveBeenCalled());
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ expectedTotalSatang: 5050, payment: { method: "cash", cashReceivedSatang: 5050 } }));
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ requestId: actions.reservePromptPayStockAction.mock.calls[0][0].requestId }));
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
