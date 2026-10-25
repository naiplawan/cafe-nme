// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ loadQueueAction: vi.fn(), advancePreparationAction: vi.fn() }));
vi.mock("./actions", () => api);
import { QueueScreen } from "./queue-screen";
const initial = [{ id: "order", dailyNo: 7, status: "received" as const, updatedAt: null, items: [{ id: "item", name: "Coffee", qty: 2, note: "No ice", modifiers: ["Oat milk"] }] }];
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
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
it("automatically shows new orders and status changes made on another device", async () => {
  vi.useFakeTimers();
  api.loadQueueAction.mockResolvedValue({ ok: true, rows: [
    { ...initial[0], status: "ready" },
    { ...initial[0], id: "new-order", dailyNo: 8 },
  ] });
  render(createElement(QueueScreen, { initial }));

  await act(() => vi.advanceTimersByTimeAsync(5000));

  expect(screen.getByRole("heading", { name: "#008" })).toBeTruthy();
  expect(screen.getByText("พร้อมรับแล้ว")).toBeTruthy();
});
it("does not overlap polls and gives a preparation tap priority over a slow refresh", async () => {
  vi.useFakeTimers();
  let resolveRefresh!: (value: { ok: true; rows: typeof initial }) => void;
  api.loadQueueAction.mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
  render(createElement(QueueScreen, { initial }));

  await act(() => vi.advanceTimersByTimeAsync(15_000));
  api.advancePreparationAction.mockResolvedValue({ ok: true, update: { id: "order", status: "preparing", updatedAt: null } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "เริ่มทำ" })); });
  expect(api.loadQueueAction).toHaveBeenCalledTimes(1);
  expect(api.advancePreparationAction).toHaveBeenCalledWith("order", "received", "preparing");

  await act(async () => { resolveRefresh({ ok: true, rows: [] }); });
  expect(screen.getByRole("button", { name: "พร้อมเสิร์ฟ" })).toBeTruthy();
});
it("keeps the last queue on a polling failure and clears the error after automatic recovery", async () => {
  vi.useFakeTimers();
  api.loadQueueAction.mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true, rows: [{ ...initial[0], status: "ready" }] });
  render(createElement(QueueScreen, { initial }));

  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "#007" })).toBeTruthy();

  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("พร้อมรับแล้ว")).toBeTruthy();
});
it("pauses polling while hidden or offline and refreshes when the screen can reconnect", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  api.loadQueueAction.mockResolvedValueOnce({ ok: true, rows: [] })
    .mockResolvedValueOnce({ ok: true, rows: [{ ...initial[0], status: "ready" }] });
  render(createElement(QueueScreen, { initial }));

  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(api.loadQueueAction).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(api.loadQueueAction).not.toHaveBeenCalled();

  online.mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(screen.getByText("ไม่มีคิววันนี้")).toBeTruthy();
  visibility.mockReturnValue("hidden");
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(api.loadQueueAction).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByText("พร้อมรับแล้ว")).toBeTruthy();
});
it("stops polling and reconnect listeners after leaving the queue screen", async () => {
  vi.useFakeTimers();
  api.loadQueueAction.mockResolvedValue({ ok: true, rows: [] });
  const { unmount } = render(createElement(QueueScreen, { initial }));
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByText("ไม่มีคิววันนี้")).toBeTruthy();
  unmount();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(api.loadQueueAction).toHaveBeenCalledTimes(1);
});
