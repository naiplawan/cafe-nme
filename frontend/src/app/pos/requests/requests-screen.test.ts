// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ loadRequestsAction: vi.fn(), decideRequestAction: vi.fn() }));
vi.mock("./actions", () => api);
import { RequestsScreen } from "./requests-screen";
const order = { id: "66666666-6666-4666-8666-666666666666", status: "pending" as const, totalSatang: 5000, dailyNo: null, mode: "table" as const, tableLabel: "7", items: [{ id: "88888888-8888-4888-8888-888888888888", name: "Coffee", qty: 1, note: "No ice", modifiers: ["Oat"], lineTotalSatang: 5000 }] };
afterEach(cleanup);
it("accepts a draft without marking it paid and offers the payment choice", async () => {
  api.decideRequestAction.mockResolvedValue({ ok: true, order: { ...order, status: "accepted" } });
  render(createElement(RequestsScreen, { initial: [order] }));
  expect(screen.getByText("โต๊ะ 7")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "รับรายการ" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "เลือกวิธีรับชำระ" })).toBeTruthy());
  expect(screen.getByRole("link", { name: "เลือกวิธีรับชำระ" }).getAttribute("href")).toBe(`/pos/requests/${order.id}/payment`);
  expect(screen.getByText("รับแล้ว · ยังไม่ชำระเงิน")).toBeTruthy();
});
it("removes a rejected draft from the staff waiting list", async () => {
  api.decideRequestAction.mockResolvedValue({ ok: true, order: { ...order, status: "rejected" } });
  render(createElement(RequestsScreen, { initial: [order] }));
  fireEvent.click(screen.getByRole("button", { name: "ไม่รับรายการ" }));
  expect(api.decideRequestAction).not.toHaveBeenCalledWith(order.id, "rejected");
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันไม่รับรายการ" }));
  await waitFor(() => expect(screen.getByText("ไม่มีรายการรอรับ")).toBeTruthy());
});
