import { BadRequestException, ConflictException } from '@nestjs/common';

export interface RecipeDefinition {
  targetKind: 'product' | 'modifier'; targetId: string; ingredientId: string;
  quantityMilliunits: number; replacesIngredientId?: string | null;
}
export function recipeRequirements(recipes: RecipeDefinition[], lines: { productId: string; qty: number; modifierIds: string[] }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const base = recipes.filter((recipe) => recipe.targetKind === 'product' && recipe.targetId === line.productId);
    const modifiers = recipes.filter((recipe) => recipe.targetKind === 'modifier' && line.modifierIds.includes(recipe.targetId));
    const replacements = new Map<string, string>();
    for (const recipe of modifiers) {
      if (!recipe.replacesIngredientId) continue;
      const previous = replacements.get(recipe.replacesIngredientId);
      if (previous && previous !== recipe.targetId) throw new ConflictException({ code: 'conflicting_recipe_replacements' });
      replacements.set(recipe.replacesIngredientId, recipe.targetId);
    }
    for (const recipe of [...base.filter((recipe) => !replacements.has(recipe.ingredientId)), ...modifiers]) {
      const amount = (totals.get(recipe.ingredientId) ?? 0) + recipe.quantityMilliunits * line.qty;
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('Recipe quantity exceeds supported range');
      totals.set(recipe.ingredientId, amount);
    }
  }
  return totals;
}
