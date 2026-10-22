// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ getOrderAction: vi.fn(), voidOrderAction: vi.fn(), searchMembersByPhone: vi.fn(), quoteCheckoutAction: vi.fn(), checkoutAction: vi.fn() }));
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
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });
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
  actions.checkoutAction.mockResolvedValue({ ok: true, result: { orderId: "paid" } });
  const onPaid = vi.fn();
  render(React.createElement(PaymentDialog, { orderLabel: "#001", lines: [line], subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, checkoutInput: { lines: [{ productId: "11111111-1111-4111-8111-111111111111", qty: 1, modifierIds: [] }] }, cartStorageKey: "cart", expectedScope: { shopId: "shop", staffId: "staff", deviceId: "device" }, promptpayEnabled: true, shopName: "Cafe", onClose: vi.fn(), onPaid }));
  await screen.findByRole("button", { name: "ยืนยันยอดใหม่" });
  expect(screen.getByRole("tab", { name: "พร้อมเพย์" }).closest("fieldset")?.disabled).toBe(true);
  expect(screen.queryByTestId("qr")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันยอดใหม่" }));
  fireEvent.click(screen.getByRole("tab", { name: "พร้อมเพย์" }));
  expect(screen.getByTestId("qr").textContent).toBe("5050");
  fireEvent.click(screen.getByRole("tab", { name: "เงินสด" }));
  fireEvent.click(screen.getByRole("button", { name: "พอดี" }));
  fireEvent.click(screen.getByRole("button", { name: /รับเงิน · ทอน/ }));
  await waitFor(() => expect(onPaid).toHaveBeenCalled());
  expect(actions.checkoutAction).toHaveBeenCalledWith(expect.objectContaining({ expectedTotalSatang: 5050, payment: { method: "cash", cashReceivedSatang: 5050 } }));
});
