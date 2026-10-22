import type { PosMenu, PosModifier } from "@/lib/validation/pos-menu";
export type { PosMenu, PosModifier, PosModifierGroup, PosProduct } from "@/lib/validation/pos-menu";

export type CartLineInput = { productId: string; qty: number; modifierIds: string[]; note?: string };
export type PricedLine = { productId: string; name: string; qty: number; note: string | null; earnsStamp: boolean; modifiers: PosModifier[]; unitPriceSatang: number; lineTotalSatang: number };

export class PricingError extends Error {
  constructor(public code: "unknown_product" | "bad_qty" | "bad_modifier" | "group_min" | "group_max") {
    super(code);
    this.name = "PricingError";
  }
}

export function hasSoldOutLine(lines: CartLineInput[], menu: PosMenu): boolean {
  const productIds = new Set(lines.map((line) => line.productId));
  return menu.products.some((product) => product.soldOut && productIds.has(product.id));
}

export function priceCart(lines: CartLineInput[], menu: PosMenu): { lines: PricedLine[]; subtotalSatang: number } {
  const productsById = new Map(menu.products.map((product) => [product.id, product]));
  const pricedLines = lines.map((line): PricedLine => {
    const product = productsById.get(line.productId);
    if (!product) throw new PricingError("unknown_product");
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) throw new PricingError("bad_qty");
    if (new Set(line.modifierIds).size !== line.modifierIds.length) throw new PricingError("bad_modifier");

    const selected = new Set(line.modifierIds);
    const modifiers = product.groups.flatMap((group) => group.modifiers).filter((modifier) => selected.has(modifier.id));
    if (modifiers.length !== line.modifierIds.length) throw new PricingError("bad_modifier");
    for (const group of product.groups) {
      const count = group.modifiers.filter((modifier) => selected.has(modifier.id)).length;
      if (count < group.minSelect) throw new PricingError("group_min");
      if (count > group.maxSelect) throw new PricingError("group_max");
    }

    const note = line.note?.trim().slice(0, 120) || null;
    const unitPriceSatang = Math.max(0, product.basePriceSatang + modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaSatang, 0));
    return { productId: product.id, name: product.name, qty: line.qty, note, earnsStamp: product.earnsStamp,
      modifiers, unitPriceSatang, lineTotalSatang: unitPriceSatang * line.qty };
  });
  return { lines: pricedLines, subtotalSatang: pricedLines.reduce((sum, line) => sum + line.lineTotalSatang, 0) };
}

export function suggestCashAmounts(totalSatang: number): number[] {
  const exactAmount = totalSatang / 100;
  const suggestions = [20, 50, 100, 500, 1000]
    .map((denomination) => Math.ceil(exactAmount / denomination) * denomination)
    .filter((amount) => amount > exactAmount);
  return [exactAmount, ...[...new Set(suggestions)].sort((a, b) => a - b).slice(0, 4)];
}

export function rewardDiscount(lines: PricedLine[]): number {
  const eligible = lines.filter((line) => line.earnsStamp);
  return eligible.length === 0 ? 0 : Math.min(...eligible.map((line) => line.unitPriceSatang));
}

export function stampsForLines(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + (line.earnsStamp ? line.qty : 0), 0);
}
