// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ bulkUpdateProductsAction: vi.fn(), clearSoldOutProductsAction: vi.fn(), reorderProductsAction: vi.fn(), setAutoClearSoldOutAction: vi.fn() }));
vi.mock("./actions", () => actions);
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props) }));
import { MenuProductList } from "./product-list";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("rolls the automatic availability setting back after a rejected save", async () => {
  actions.setAutoClearSoldOutAction.mockResolvedValue({ success: false, message: "บันทึกไม่สำเร็จ" });
  render(React.createElement(MenuProductList, { categories: [], autoClearSoldOut: true, products: [{ id: "coffee", name: "Coffee", basePriceSatang: 5000, imageUrl: null, tileColor: null, isActive: true, earnsStamp: true, soldOut: false, categoryId: null, categoryName: null }] }));
  const toggle = screen.getByRole("checkbox", { name: /เปิดขายสินค้าที่หมดอัตโนมัติ/ });
  fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("บันทึกไม่สำเร็จ"));
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(toggle.hasAttribute("disabled")).toBe(false);
});
