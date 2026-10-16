export const MENU_STEPS = ["categories", "products", "preview"] as const;
export type MenuStep = (typeof MENU_STEPS)[number];

export const PRODUCT_STATUSES = ["all", "active", "inactive", "soldOut"] as const;
export type ProductFilters = { q: string; category: string; status: string };
export const DEFAULT_PRODUCT_FILTERS: ProductFilters = { q: "", category: "all", status: "all" };

type Query = URLSearchParams | Record<string, string | string[] | undefined>;

function first(query: Query, key: string) {
  const value = query instanceof URLSearchParams ? query.get(key) : query[key];
  return (Array.isArray(value) ? value[0] : value) ?? undefined;
}

export function parseMenuStep(value: unknown, categoryCount: number): MenuStep {
  if (typeof value === "string" && (MENU_STEPS as readonly string[]).includes(value)) return value as MenuStep;
  // A shop without categories starts where products depend on it.
  return categoryCount === 0 ? "categories" : "products";
}

export function parseProductFilters(query: Query): ProductFilters {
  const q = first(query, "q")?.slice(0, 80) ?? "";
  const category = first(query, "category")?.slice(0, 64) || "all";
  const status = first(query, "status") ?? "all";
  return { q, category, status: (PRODUCT_STATUSES as readonly string[]).includes(status) ? status : "all" };
}

export function menuQuery(step: MenuStep, filters: ProductFilters = DEFAULT_PRODUCT_FILTERS) {
  const params = new URLSearchParams({ step });
  if (filters.q.trim()) params.set("q", filters.q);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.status !== "all") params.set("status", filters.status);
  return params.toString();
}

export function menuHref(step: MenuStep, filters?: ProductFilters) {
  return `/admin/menu?${menuQuery(step, filters)}`;
}

/** Rebuilds the list URL from an edit page's `back` param, keeping only known filters. */
export function menuReturnHref(back: unknown) {
  if (typeof back !== "string") return menuHref("products");
  return menuHref("products", parseProductFilters(new URLSearchParams(back)));
}

export function productEditHref(productId: string, filters: ProductFilters) {
  return `/admin/menu/${productId}?back=${encodeURIComponent(menuQuery("products", filters))}`;
}

/** Confirmation text and button label for a bulk-bar submit button. */
export function bulkActionConfirmation(
  action: { name?: string; value?: string },
  count: number,
  hiddenCount: number,
  groupName?: string,
) {
  const hiddenNote = hiddenCount > 0 ? ` โดยมี ${hiddenCount} รายการซ่อนจากตัวกรอง` : "";
  if (action.name === "restoreForSale") {
    return { message: `เปิดขายสินค้า ${count} รายการและล้างสถานะหมด${hiddenNote}หรือไม่?`, label: "เปิดขาย" };
  }
  if (action.name === "modifierGroupAction") {
    const group = `“${groupName ?? "กลุ่มตัวเลือก"}”`;
    return action.value === "add"
      ? { message: `เพิ่ม ${group} ให้สินค้า ${count} รายการ${hiddenNote}หรือไม่?`, label: "เพิ่ม" }
      : { message: `เอา ${group} ออกจากสินค้า ${count} รายการ${hiddenNote}หรือไม่?`, label: "เอาออก" };
  }
  const show = action.value === "true";
  return {
    message: `${show ? "แสดง" : "ซ่อน"}สินค้า ${count} รายการ${show ? "บนหน้าขาย" : "จากหน้าขาย"}${hiddenNote}หรือไม่?`,
    label: show ? "แสดง" : "ซ่อน",
  };
}

/** Returns a copy of the list with the item at `from` moved to index `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
