import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { parseName, parseProduct } from '../src/menu-input.js';

test('menu names are trimmed and bounded', () => {
  assert.equal(parseName('  Latte  '), 'Latte');
  assert.throws(() => parseName('  '), BadRequestException);
  assert.throws(() => parseName('x'.repeat(81)), BadRequestException);
});

test('product input normalizes optional values and deduplicates modifier groups', () => {
  const firstGroup = '11111111-1111-4111-8111-111111111111';
  const secondGroup = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(
    parseProduct({
      name: ' Latte ',
      price: 5000,
      categoryId: null,
      imageUrl: '  ',
      tileColor: null,
      earnsStamp: true,
      isActive: true,
      modifierGroupIds: [firstGroup, secondGroup, firstGroup],
    }),
    {
      name: 'Latte',
      price: 5000,
      categoryId: null,
      imageUrl: null,
      tileColor: null,
      earnsStamp: true,
      isActive: true,
      modifierGroupIds: [firstGroup, secondGroup],
    },
  );
});

test('product input rejects invalid prices, IDs, flags, and tile colours', () => {
  const valid = {
    name: 'Latte',
    price: 5000,
    categoryId: null,
    imageUrl: null,
    earnsStamp: true,
    isActive: true,
    modifierGroupIds: [],
  };
  for (const override of [
    { price: -1 },
    { price: 1.5 },
    { categoryId: 'bad' },
    { earnsStamp: 'yes' },
    { tileColor: 'ultraviolet' },
    { modifierGroupIds: ['bad'] },
  ]) {
    assert.throws(() => parseProduct({ ...valid, ...override }), BadRequestException);
  }
});
