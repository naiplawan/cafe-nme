import assert from "node:assert/strict";
import test from "node:test";
import {
  businessDate,
  calculatePrice,
  CheckoutDomainError,
  rewardDiscount,
  stampsForLines,
} from "../src/checkout-domain.js";

test("checkout price includes selected modifier deltas and trims notes", () => {
  const result = calculatePrice(
    [{ productId: "coffee", qty: 2, modifierIds: ["oat"], note: "  less ice  " }],
    [{
      id: "coffee", name: "Latte", basePriceSatang: 5000, earnsStamp: true, soldOut: false,
      groups: [{ id: "milk", minSelect: 1, maxSelect: 1, modifiers: [{ id: "oat", name: "Oat", priceDeltaSatang: 250 }] }],
    }],
  );

  assert.deepEqual(result, {
    lines: [{
      productId: "coffee", name: "Latte", qty: 2, note: "less ice", earnsStamp: true,
      modifiers: [{ id: "oat", name: "Oat", priceDeltaSatang: 250 }],
      basePriceSatang: 5000, unitPriceSatang: 5250, lineTotalSatang: 10_500,
    }],
    subtotalSatang: 10_500,
  });
});

test("checkout rejects a modifier group below its minimum selection", () => {
  assert.throws(
    () => calculatePrice(
      [{ productId: "coffee", qty: 1, modifierIds: [] }],
      [{
        id: "coffee", name: "Latte", basePriceSatang: 5000, earnsStamp: true, soldOut: false,
        groups: [{ id: "temperature", minSelect: 1, maxSelect: 1, modifiers: [{ id: "iced", name: "Iced", priceDeltaSatang: 0 }] }],
      }],
    ),
    (error: unknown) => error instanceof CheckoutDomainError && error.code === "pricing",
  );
});

test("checkout computes reward discount from the cheapest eligible line and totals earned stamps", () => {
  const { lines } = calculatePrice(
    [
      { productId: "tea", qty: 2, modifierIds: [] },
      { productId: "cake", qty: 1, modifierIds: [] },
    ],
    [
      { id: "tea", name: "Tea", basePriceSatang: 4500, earnsStamp: true, soldOut: false, groups: [] },
      { id: "cake", name: "Cake", basePriceSatang: 3000, earnsStamp: false, soldOut: false, groups: [] },
    ],
  );

  assert.equal(rewardDiscount(lines), 4500);
  assert.equal(stampsForLines(lines), 2);
});

test("business date follows the shop timezone across UTC midnight", () => {
  assert.equal(businessDate(new Date("2025-02-01T17:30:00.000Z"), "Asia/Bangkok"), "2025-02-02");
});
