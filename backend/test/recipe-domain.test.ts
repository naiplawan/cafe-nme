import assert from 'node:assert/strict';
import test from 'node:test';
import { recipeRequirements } from '../src/recipe-domain.js';

const base = { targetKind: 'product' as const, targetId: 'coffee', ingredientId: 'milk', quantityMilliunits: 200000 };
const oat = { targetKind: 'modifier' as const, targetId: 'oat-option', ingredientId: 'oat', quantityMilliunits: 200000, replacesIngredientId: 'milk' };
const shot = { targetKind: 'modifier' as const, targetId: 'shot', ingredientId: 'beans', quantityMilliunits: 18000 };
test('replacement removes only base milk, while extra shot stays additive for every cup', () => {
  assert.deepEqual(recipeRequirements([base, oat, shot], [{ productId: 'coffee', qty: 2, modifierIds: ['shot', 'oat-option'] }]), new Map([['oat',400000],['beans',36000]]));
});
test('replacement absent from base still adds its own ingredient', () => {
  assert.deepEqual(recipeRequirements([oat], [{ productId: 'coffee', qty: 1, modifierIds: ['oat-option'] }]), new Map([['oat',200000]]));
});
test('two modifiers cannot replace the same base ingredient', () => {
  assert.throws(() => recipeRequirements([base, oat, { ...oat, targetId: 'soy-option', ingredientId: 'soy' }],
    [{ productId: 'coffee', qty: 1, modifierIds: ['oat-option','soy-option'] }]));
});
test('replacements preserve separate additive milk', () => {
  assert.equal(recipeRequirements([base, oat, { ...shot, ingredientId: 'milk', quantityMilliunits: 10000 }],
    [{ productId: 'coffee', qty: 1, modifierIds: ['shot','oat-option'] }]).get('milk'), 10000);
});
