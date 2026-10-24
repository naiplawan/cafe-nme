// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ loadQueueAction: vi.fn(), advancePreparationAction: vi.fn() }));
vi.mock("./actions", () => api);
import { QueueScreen } from "./queue-screen";
const initial = [{ id: "order", dailyNo: 7, status: "received" as const, updatedAt: null, items: [{ id: "item", name: "Coffee", qty: 2, note: "No ice", modifiers: ["Oat milk"] }] }];
beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);
it("shows queue number, quantities, modifiers and preparation notes", () => {
  render(createElement(QueueScreen, { initial }));
  expect(screen.getByRole("heading", { name: "#007" })).toBeTruthy();
  expect(screen.getByText("2 × Coffee")).toBeTruthy();
  expect(screen.getByText("Oat milk")).toBeTruthy();
  expect(screen.getByText("No ice")).toBeTruthy();
});
it("advances received to preparing to ready and retains the ready card", async () => {
  api.advancePreparationAction.mockResolvedValueOnce({ ok: true, update: { id: "order", status: "preparing", updatedAt: "now" } })
    .mockResolvedValueOnce({ ok: true, update: { id: "order", status: "ready", updatedAt: "later" } });
  render(createElement(QueueScreen, { initial }));
  fireEvent.click(screen.getByRole("button", { name: "เริ่มทำ" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "พร้อมเสิร์ฟ" })).toBeTruthy());
  expect(api.advancePreparationAction).toHaveBeenNthCalledWith(1, "order", "received", "preparing");
  fireEvent.click(screen.getByRole("button", { name: "พร้อมเสิร์ฟ" }));
  await waitFor(() => expect(screen.getByText("พร้อมรับแล้ว")).toBeTruthy());
  expect(api.advancePreparationAction).toHaveBeenNthCalledWith(2, "order", "preparing", "ready");
  expect(screen.getByRole("heading", { name: "#007" })).toBeTruthy();
});
it("preserves the queue on a failed refresh and lets staff retry", async () => {
  api.loadQueueAction.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, rows: [] });
  render(createElement(QueueScreen, { initial }));
  fireEvent.click(screen.getByRole("button", { name: "รีเฟรชคิว" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("heading", { name: "#007" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "รีเฟรชคิว" }));
  await waitFor(() => expect(screen.getByText("ไม่มีคิววันนี้")).toBeTruthy());
});
it("refreshes after a stale transition instead of optimistically advancing", async () => {
  api.advancePreparationAction.mockResolvedValue({ ok: false, message: "คิวเปลี่ยนแล้ว" });
  api.loadQueueAction.mockResolvedValue({ ok: true, rows: [{ ...initial[0], status: "ready" }] });
  render(createElement(QueueScreen, { initial }));
  fireEvent.click(screen.getByRole("button", { name: "เริ่มทำ" }));
  await waitFor(() => expect(screen.getByText("พร้อมรับแล้ว")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "พร้อมเสิร์ฟ" })).toBeNull();
});
