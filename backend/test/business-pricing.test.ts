import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePrice, rewardDiscount, stampsForLines, rewardLineIndex } from '../src/checkout-domain.js';
const products = [{ id: 'latte', name: 'Latte', basePriceSatang: 6500, earnsStamp: true, soldOut: false,
  groups: [{ id: 'milk', minSelect: 0, maxSelect: 1, modifiers: [{ id: 'oat', name: 'Oat', priceDeltaSatang: 1500 }] }] },
  { id: 'mocha', name: 'Mocha', basePriceSatang: 7000, earnsStamp: true, soldOut: false, groups: [] }];
test('reward chooses cheapest base, retains premium addons and excludes the reward unit from stamps', () => {
  const { lines } = calculatePrice([{ productId: 'latte', qty: 2, modifierIds: ['oat'] }, { productId: 'mocha', qty: 1, modifierIds: [] }], products);
  assert.equal(rewardDiscount(lines), 6500);
  assert.equal(rewardLineIndex(lines), 0);
  assert.equal(stampsForLines(lines, true), 2);
});
test('zero-price drinks do not earn stamps and ties use first cart line', () => {
  const { lines } = calculatePrice([{ productId: 'latte', qty: 1, modifierIds: [] }, { productId: 'mocha', qty: 1, modifierIds: [] }], products.map(p => ({ ...p, basePriceSatang: 0 })));
  assert.equal(stampsForLines(lines), 0);
  assert.equal(rewardDiscount(lines), 0);
});
