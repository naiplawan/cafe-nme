export type CheckoutFailure =
  | 'price_changed'
  | 'empty_cart'
  | 'pricing'
  | 'sold_out'
  | 'member_not_found'
  | 'reward_unavailable'
  | 'reward_ineligible'
  | 'cash_insufficient'
  | 'promptpay_not_configured';

export const MAX_CHECKOUT_UNITS = 500;

export class CheckoutDomainError extends Error {
  constructor(readonly code: CheckoutFailure) {
    super(code);
  }
}

export interface CheckoutCartLine {
  productId: string;
  qty: number;
  modifierIds: string[];
  note?: string;
}

export interface CheckoutProduct {
  id: string;
  name: string;
  basePriceSatang: number;
  earnsStamp: boolean;
  soldOut: boolean;
  groups: {
    id: string;
    minSelect: number;
    maxSelect: number;
    modifiers: { id: string; name: string; priceDeltaSatang: number }[];
  }[];
}

export interface PricedLine {
  productId: string;
  name: string;
  qty: number;
  note: string | null;
  earnsStamp: boolean;
  modifiers: { id: string; name: string; priceDeltaSatang: number }[];
  unitPriceSatang: number;
  lineTotalSatang: number;
}

export function businessDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function calculatePrice(
  lines: CheckoutCartLine[],
  products: CheckoutProduct[],
): { lines: PricedLine[]; subtotalSatang: number } {
  const byId = new Map(products.map((product) => [product.id, product]));
  const priced = lines.map((line): PricedLine => {
    const product = byId.get(line.productId);
    if (
      !product ||
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      line.qty > 99 ||
      new Set(line.modifierIds).size !== line.modifierIds.length
    ) {
      throw new CheckoutDomainError('pricing');
    }
    if (product.soldOut) {
      throw new CheckoutDomainError('sold_out');
    }
    const selected = new Set(line.modifierIds);
    const modifiers = product.groups
      .flatMap((group) => group.modifiers)
      .filter((modifier) => selected.has(modifier.id));
    if (modifiers.length !== line.modifierIds.length) {
      throw new CheckoutDomainError('pricing');
    }
    for (const group of product.groups) {
      const count = group.modifiers.filter((modifier) => selected.has(modifier.id)).length;
      if (count < group.minSelect || count > group.maxSelect) {
        throw new CheckoutDomainError('pricing');
      }
    }
    const note = line.note?.trim().slice(0, 120) || null;
    const unitPriceSatang = Math.max(
      0,
      product.basePriceSatang + modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaSatang, 0),
    );
    return {
      productId: product.id,
      name: product.name,
      qty: line.qty,
      note,
      earnsStamp: product.earnsStamp,
      modifiers,
      unitPriceSatang,
      lineTotalSatang: unitPriceSatang * line.qty,
    };
  });
  return { lines: priced, subtotalSatang: priced.reduce((sum, line) => sum + line.lineTotalSatang, 0) };
}

export function rewardDiscount(lines: PricedLine[]): number {
  const eligible = lines.filter((line) => line.earnsStamp);
  return eligible.length === 0 ? 0 : Math.min(...eligible.map((line) => line.unitPriceSatang));
}

export function stampsForLines(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + (line.earnsStamp ? line.qty : 0), 0);
}
