import { describe, expect, it } from "vitest";
import { hasSoldOutLine, priceCart, PricingError, rewardDiscount, stampsForLines, suggestCashAmounts, type PosMenu } from "./pricing";

const menu: PosMenu = {
  categories: [{ id: "coffee", name: "กาแฟ" }],
  products: [{
    id: "latte", name: "ลาเต้", categoryId: "coffee", basePriceSatang: 5000,
    imageUrl: null, earnsStamp: true, soldOut: false,
    groups: [
      { id: "size", name: "ขนาด", minSelect: 1, maxSelect: 1, modifiers: [
        { id: "regular", name: "ปกติ", priceDeltaSatang: 0 },
        { id: "large", name: "ใหญ่", priceDeltaSatang: 1000 },
      ] },
      { id: "milk", name: "นม", minSelect: 0, maxSelect: 2, modifiers: [
        { id: "oat", name: "นมโอ๊ต", priceDeltaSatang: 1500 },
      ] },
    ],
  }],
};

describe("priceCart", () => {
  it("keeps sold-out state separate from price calculation", () => {
    const soldOutMenu = { ...menu, products: [{ ...menu.products[0], soldOut: true }] };
    expect(priceCart([{ productId: "latte", qty: 1, modifierIds: ["regular"] }], soldOutMenu).subtotalSatang).toBe(5000);
  });

  it("prices from menu data, trims notes, and calculates subtotal", () => {
    expect(priceCart([{ productId: "latte", qty: 2, modifierIds: ["large", "oat"], note: "  ร้อน  " }], menu))
      .toEqual({ lines: [{ productId: "latte", name: "ลาเต้", qty: 2, note: "ร้อน", earnsStamp: true,
        modifiers: [menu.products[0].groups[0].modifiers[1], menu.products[0].groups[1].modifiers[0]],
        unitPriceSatang: 7500, lineTotalSatang: 15_000 }], subtotalSatang: 15_000 });
  });

  it("orders selected modifiers by group and modifier order instead of tap order", () => {
    const result = priceCart([{ productId: "latte", qty: 1, modifierIds: ["oat", "large"] }], menu);
    expect(result.lines[0].modifiers.map((modifier) => modifier.name)).toEqual(["ใหญ่", "นมโอ๊ต"]);
  });

  it("rejects unknown product, invalid quantity, and duplicate modifier ids", () => {
    expect(() => priceCart([{ productId: "x", qty: 1, modifierIds: [] }], menu)).toThrowError(PricingError);
    expect(() => priceCart([{ productId: "latte", qty: 0, modifierIds: ["regular"] }], menu)).toThrowError(/bad_qty/);
    expect(() => priceCart([{ productId: "latte", qty: 1, modifierIds: ["regular", "regular"] }], menu)).toThrowError(/bad_modifier/);
  });

  it("requires modifiers to belong to attached groups and enforces group min/max", () => {
    const unattached = { ...menu, products: [{ ...menu.products[0], groups: [menu.products[0].groups[0]] }] };
    expect(() => priceCart([{ productId: "latte", qty: 1, modifierIds: ["regular", "oat"] }], unattached)).toThrowError(/bad_modifier/);
    expect(() => priceCart([{ productId: "latte", qty: 1, modifierIds: [] }], menu)).toThrowError(/group_min/);
    expect(() => priceCart([{ productId: "latte", qty: 1, modifierIds: ["regular", "oat", "oat"] }], menu)).toThrowError(/bad_modifier/);
  });

  it("clamps unit price at zero and truncates notes to 120 characters", () => {
    const freeMenu: PosMenu = { categories: [], products: [{ ...menu.products[0], basePriceSatang: 10,
      groups: [{ id: "g", name: "g", minSelect: 0, maxSelect: 1, modifiers: [{ id: "discount", name: "ส่วนลด", priceDeltaSatang: -50 }] }] }] };
    const result = priceCart([{ productId: "latte", qty: 1, modifierIds: ["discount"], note: ` ${"a".repeat(125)} ` }], freeMenu);
    expect(result.lines[0].unitPriceSatang).toBe(0);
    expect(result.lines[0].note).toHaveLength(120);
  });

  it("maps blank notes to null and rejects quantities above 99", () => {
    expect(priceCart([{ productId: "latte", qty: 1, modifierIds: ["regular"], note: "  " }], menu).lines[0].note).toBeNull();
    expect(() => priceCart([{ productId: "latte", qty: 100, modifierIds: ["regular"] }], menu)).toThrowError(/bad_qty/);
    expect(() => priceCart([{ productId: "latte", qty: 1.5, modifierIds: ["regular"] }], menu)).toThrowError(/bad_qty/);
  });
});

describe("hasSoldOutLine", () => {
  it("detects sold-out products in the cart and ignores unrelated products", () => {
    const soldOutMenu = { ...menu, products: [{ ...menu.products[0], soldOut: true }] };
    expect(hasSoldOutLine([{ productId: "latte", qty: 1, modifierIds: ["regular"] }], soldOutMenu)).toBe(true);
    expect(hasSoldOutLine([{ productId: "other", qty: 1, modifierIds: [] }], soldOutMenu)).toBe(false);
  });
});

describe("suggestCashAmounts", () => {
  it("offers the exact amount including satang", () => {
    expect(suggestCashAmounts(5050)).toEqual([50.5, 60, 100, 500, 1000]);
  });
  it("suggests unique ascending round amounts after the exact amount", () => {
    expect(suggestCashAmounts(21_000)).toEqual([210, 220, 250, 300, 500]);
  });

  it("returns at most four suggestions and uses the next round-up", () => {
    expect(suggestCashAmounts(51_000)).toEqual([510, 520, 550, 600, 1000]);
  });
});

it("computes cheapest eligible reward discount and stamp quantity", () => {
  const { lines } = priceCart([
    { productId: "latte", qty: 2, modifierIds: ["regular"] },
    { productId: "latte", qty: 1, modifierIds: ["large"] },
  ], menu);
  expect(rewardDiscount(lines)).toBe(5000);
  expect(stampsForLines(lines)).toBe(3);
  expect(rewardDiscount([])).toBe(0);
});
