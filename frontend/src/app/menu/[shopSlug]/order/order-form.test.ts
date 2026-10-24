// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ submitSelfOrderAction: vi.fn(), selfOrderStatusAction: vi.fn() }));
vi.mock("./actions", () => api);
import { OrderForm } from "./order-form";
const menu = { categories: [], products: [{ id: "77777777-7777-4777-8777-777777777777", name: "Coffee", categoryId: null, basePriceSatang: 5000, imageUrl: null, tileColor: null, earnsStamp: true, soldOut: false, groups: [] }] };
const view = { id: "66666666-6666-4666-8666-666666666666", status: "pending", totalSatang: 5000, dailyNo: null, mode: "pickup", tableLabel: null, items: [{ id: "88888888-8888-4888-8888-888888888888", name: "Coffee", qty: 1, note: null, modifiers: [], lineTotalSatang: 5000 }] };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(cleanup);
it("submits a customer cart as awaiting acceptance and payment, never paid", async () => {
  api.submitSelfOrderAction.mockResolvedValue({ ok: true, order: view });
  render(createElement(OrderForm, { menu, shopSlug: "cafe", shopName: "Cafe" }));
  fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Coffee" }));
  fireEvent.click(screen.getByRole("button", { name: "ส่งรายการให้ร้าน" }));
  await waitFor(() => expect(screen.getByText("รอร้านรับรายการ · ยังไม่ชำระเงิน")).toBeTruthy());
  expect(screen.queryByText("ชำระเงินแล้ว")).toBeNull();
  expect(api.submitSelfOrderAction).toHaveBeenCalledWith("cafe", expect.objectContaining({ mode: "pickup", tableLabel: null, lines: [{ productId: menu.products[0].id, qty: 1, modifierIds: [], note: "" }] }));
});
it("retains the original request across an ambiguous response and reload", async () => {
  api.submitSelfOrderAction.mockRejectedValueOnce(new Error("offline"));
  const first = render(createElement(OrderForm, { menu, shopSlug: "cafe", shopName: "Cafe" }));
  fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Coffee" }));
  fireEvent.click(screen.getByRole("button", { name: "ส่งรายการให้ร้าน" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  const original = api.submitSelfOrderAction.mock.calls[0][1];
  first.unmount();
  api.submitSelfOrderAction.mockResolvedValue({ ok: true, order: view });
  render(createElement(OrderForm, { menu, shopSlug: "cafe", shopName: "Cafe" }));
  fireEvent.click(await screen.findByRole("button", { name: "ตรวจสอบรายการเดิม" }));
  await waitFor(() => expect(screen.getByText("รอร้านรับรายการ · ยังไม่ชำระเงิน")).toBeTruthy());
  expect(api.submitSelfOrderAction.mock.calls[1][1]).toEqual(original);
});
