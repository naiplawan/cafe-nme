import { describe, expect, it } from "vitest";
import { deserializeCart, serializeCart, validateCart, type CartSnapshot } from "./cart-storage";
import type { PosMenu } from "./pricing";

const menu: PosMenu = {
  categories: [],
  products: [
    { id: "latte", name: "ลาเต้", categoryId: null, basePriceSatang: 5000, imageUrl: null, earnsStamp: true, soldOut: false,
      groups: [{ id: "size", name: "ขนาด", minSelect: 1, maxSelect: 1, modifiers: [
        { id: "regular", name: "ปกติ", priceDeltaSatang: 0 }, { id: "large", name: "ใหญ่", priceDeltaSatang: 1000 },
      ] }] },
    { id: "cake", name: "เค้ก", categoryId: null, basePriceSatang: 3000, imageUrl: null, earnsStamp: false, soldOut: false, groups: [] },
    { id: "sold", name: "โกโก้", categoryId: null, basePriceSatang: 4000, imageUrl: null, earnsStamp: false, soldOut: true, groups: [] },
  ],
};

const snapshot: CartSnapshot = {
  lines: [{ productId: "latte", qty: 2, modifierIds: ["regular"] }], memberId: "member-1", redeemRewardId: "reward-1",
};

describe("cart storage", () => {
  it("serializes and restores cart, member, and reward ids", () => {
    expect(deserializeCart(serializeCart(snapshot))).toEqual(snapshot);
  });

  it("rejects invalid stored JSON and malformed snapshots", () => {
    expect(deserializeCart("{" )).toBeNull();
    expect(deserializeCart(JSON.stringify({ lines: "bad" }))).toBeNull();
  });

  it("drops missing, sold-out, and invalid lines while preserving valid lines", () => {
    const result = validateCart({ ...snapshot, lines: [
      ...snapshot.lines,
      { productId: "deleted", qty: 1, modifierIds: [] },
      { productId: "sold", qty: 1, modifierIds: [] },
      { productId: "latte", qty: 1, modifierIds: [] },
    ] }, menu);
    expect(result).toEqual({
      snapshot: { ...snapshot, lines: snapshot.lines },
      dropped: 3,
    });
  });

  it("removes stale modifier ids and keeps the line when required groups remain valid", () => {
    const result = validateCart({ ...snapshot, lines: [
      { productId: "latte", qty: 1, modifierIds: ["regular", "deleted-modifier"] },
    ] }, menu);
    expect(result.snapshot.lines).toEqual([{ productId: "latte", qty: 1, modifierIds: ["regular"] }]);
    expect(result.dropped).toBe(0);
  });

  it("drops a line when removing stale modifiers breaks a required group", () => {
    const result = validateCart({ ...snapshot, lines: [
      { productId: "latte", qty: 1, modifierIds: ["removed-size"] },
    ] }, menu);
    expect(result.snapshot.lines).toEqual([]);
    expect(result.dropped).toBe(1);
  });
});

it("preserves accepted self-order source and exact lines when catalog changes", () => {
  const saved = { ...snapshot, selfOrderId: "66666666-6666-4666-8666-666666666666", lines: [{ productId: "deleted", qty: 1, modifierIds: ["old"] }] };
  const restored = deserializeCart(serializeCart(saved));
  expect(restored).toEqual(saved);
  expect(validateCart(restored!, menu)).toEqual({ snapshot: saved, dropped: 0 });
});
