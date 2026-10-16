import { describe, expect, it } from "vitest";
import { menuHref, menuReturnHref, parseMenuStep, parseProductFilters, productEditHref } from "./menu-steps";

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
