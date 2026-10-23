// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PosProduct } from "@/lib/pricing";

vi.mock("@/components/motion/gsap", () => ({ useGSAP: () => undefined, gsap: {}, MOTION: {}, prefersReducedMotion: () => true }));

import { ModifierSheet } from "./modifier-sheet";

const product: PosProduct = {
  id: "coffee", name: "Coffee", categoryId: null, basePriceSatang: 5000, imageUrl: null,
  tileColor: null, earnsStamp: true, soldOut: false,
  groups: [{ id: "size", name: "Size", minSelect: 1, maxSelect: 1, modifiers: [] }],
};
afterEach(cleanup);

it("explains incomplete required options and prevents adding the product", () => {
  const onConfirm = vi.fn();
  render(createElement(ModifierSheet, { product, onClose: vi.fn(), onConfirm }));
  expect(screen.getByRole("alert").textContent).toContain("ตัวเลือกไม่ครบ");
  const button = screen.getByRole("button", { name: /ไม่พร้อมขาย/ });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(onConfirm).not.toHaveBeenCalled();
});

it("allows adding a configured product after the required option is selected", () => {
  const onConfirm = vi.fn();
  render(createElement(ModifierSheet, {
    product: { ...product, groups: [{ ...product.groups[0], modifiers: [{ id: "small", name: "Small", priceDeltaSatang: 0 }] }] },
    onClose: vi.fn(), onConfirm,
  }));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Small/ }));
  fireEvent.click(screen.getByRole("button", { name: /เพิ่มลงออเดอร์/ }));
  expect(onConfirm).toHaveBeenCalledWith(["small"], 1);
});
