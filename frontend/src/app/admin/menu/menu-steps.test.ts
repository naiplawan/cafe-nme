import { describe, expect, it } from "vitest";
import { bulkActionConfirmation, menuHref, moveItem, menuReturnHref, parseMenuStep, parseProductFilters, productEditHref } from "./menu-steps";

describe("menu steps", () => {
  it("lets any known step be opened directly", () => {
    expect(parseMenuStep("preview", 0)).toBe("preview");
    expect(parseMenuStep("categories", 3)).toBe("categories");
  });

  it("starts a shop without categories on the categories step", () => {
    expect(parseMenuStep(undefined, 0)).toBe("categories");
    expect(parseMenuStep("unknown", 2)).toBe("products");
  });

  it("drops unknown statuses and keeps only non-default filters in links", () => {
    const filters = parseProductFilters({ q: "latte", category: "abc", status: "bogus" });
    expect(filters).toEqual({ q: "latte", category: "abc", status: "all" });
    expect(menuHref("products", filters)).toBe("/admin/menu?step=products&q=latte&category=abc");
  });

  it("round-trips list filters through the edit page", () => {
    const filters = { q: "ชา", category: "all", status: "soldOut" };
    const edit = productEditHref("p1", filters);
    const back = new URL(edit, "http://local").searchParams.get("back");
    expect(menuReturnHref(back)).toBe(menuHref("products", filters));
  });

  it("ignores a back param that tries to leave the menu", () => {
    expect(menuReturnHref("https://evil.example")).toBe("/admin/menu?step=products");
    expect(menuReturnHref(undefined)).toBe("/admin/menu?step=products");
  });
});

describe("bulk action confirmation", () => {
  it("names the modifier group being added or removed", () => {
    expect(bulkActionConfirmation({ name: "modifierGroupAction", value: "add" }, 3, 0, "ความหวาน"))
      .toEqual({ message: "เพิ่ม “ความหวาน” ให้สินค้า 3 รายการหรือไม่?", label: "เพิ่ม" });
    expect(bulkActionConfirmation({ name: "modifierGroupAction", value: "remove" }, 2, 1, "นม").message)
      .toBe("เอา “นม” ออกจากสินค้า 2 รายการ โดยมี 1 รายการซ่อนจากตัวกรองหรือไม่?");
  });

  it("keeps the existing visibility and reopen wording", () => {
    expect(bulkActionConfirmation({ name: "isActive", value: "false" }, 4, 0).message).toBe("ซ่อนสินค้า 4 รายการจากหน้าขายหรือไม่?");
    expect(bulkActionConfirmation({ name: "restoreForSale", value: "true" }, 1, 0).label).toBe("เปิดขาย");
  });
});

describe("moveItem", () => {
  it("moves an item up or down without mutating the input", () => {
    const list = ["a", "b", "c", "d"];
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores moves outside the list", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});
