import { priceCart, type CartLineInput, type PosMenu } from "@/lib/pricing";

const SOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CartSnapshot = { selfOrderId?: string; lines: CartLineInput[]; memberId: string | null; redeemRewardId: string | null };

export function serializeCart(snapshot: CartSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeCart(value: string | null): CartSnapshot | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const snapshot = parsed as Partial<CartSnapshot>;
    if ((snapshot.selfOrderId !== undefined && (typeof snapshot.selfOrderId !== "string" || !SOURCE_ID.test(snapshot.selfOrderId))) ||
      !Array.isArray(snapshot.lines) ||
      !(snapshot.memberId === null || typeof snapshot.memberId === "string") ||
      !(snapshot.redeemRewardId === null || typeof snapshot.redeemRewardId === "string")) return null;
    if (!snapshot.lines.every((line) => line && typeof line.productId === "string" &&
      Number.isInteger(line.qty) && Array.isArray(line.modifierIds) &&
      line.modifierIds.every((id) => typeof id === "string") &&
      (line.note === undefined || typeof line.note === "string"))) return null;
    return snapshot as CartSnapshot;
  } catch {
    return null;
  }
}

export function validateCart(snapshot: CartSnapshot, menu: PosMenu): { snapshot: CartSnapshot; dropped: number } {
  if (snapshot.selfOrderId) { return { snapshot, dropped: 0 }; }
  const productsById = new Map(menu.products.map((product) => [product.id, product]));
  let dropped = 0;
  const lines = snapshot.lines.flatMap((line) => {
    const product = productsById.get(line.productId);
    if (!product || product.soldOut) {
      dropped++;
      return [];
    }
    const availableModifiers = new Set(product.groups.flatMap((group) => group.modifiers.map(({ id }) => id)));
    const cleaned = { ...line, modifierIds: line.modifierIds.filter((id) => availableModifiers.has(id)).sort() };
    try {
      priceCart([cleaned], menu);
      return [cleaned];
    } catch {
      dropped++;
      return [];
    }
  });
  return { snapshot: { ...snapshot, lines }, dropped };
}
