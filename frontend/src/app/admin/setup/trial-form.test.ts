// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ trialCheckoutAction: vi.fn() }));
vi.mock("./actions", () => api);
import { TrialForm } from "./trial-form";
const menu = { categories: [], products: [{ id: "66666666-6666-4666-8666-666666666666", name: "Coffee", categoryId: null, basePriceSatang: 5000, imageUrl: null, earnsStamp: true, soldOut: false, groups: [{ id: "group", name: "Milk", minSelect: 1, maxSelect: 1, modifiers: [{ id: "77777777-7777-4777-8777-777777777777", name: "Regular", priceDeltaSatang: 0 }] }] }] };
afterEach(cleanup);
it("uses required modifiers and displays a trial result without a sale receipt", async () => {
  api.trialCheckoutAction.mockResolvedValue({ ok: true, summary: { totalSatang: 5000, itemCount: 1, method: "cash" } });
  render(createElement(TrialForm, { menu }));
  expect(screen.getByText(/ไม่ต้องโอนเงินจริง/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "ทดลองออกบิล" }));
  await waitFor(() => expect(screen.getByText(/ทดลองสำเร็จ/)).toBeTruthy());
  expect(api.trialCheckoutAction).toHaveBeenCalledWith([{ productId: menu.products[0].id, qty: 1, modifierIds: [menu.products[0].groups[0].modifiers[0].id] }], "cash");
  expect(screen.queryByRole("link", { name: /ใบเสร็จ/ })).toBeNull();
});
it("releases controls after a failed trial without claiming success", async () => {
  api.trialCheckoutAction.mockRejectedValue(new Error("offline"));
  render(createElement(TrialForm, { menu }));
  fireEvent.click(screen.getByRole("button", { name: "ทดลองออกบิล" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("button", { name: "ทดลองออกบิล" }).hasAttribute("disabled")).toBe(false);
  expect(screen.queryByText(/ทดลองสำเร็จ/)).toBeNull();
});
