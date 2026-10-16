import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as productList from "./product-list";

describe("menu bulk selection", () => {
  it("exposes a helper that ignores stale product selections", () => {
    expect(productList.getValidSelectedProductIds).toBeTypeOf("function");
    expect(productList.getValidSelectedProductIds(["one", "stale", "two"], ["two", "one"])).toEqual(["one", "two"]);
  });

  it("reports selected products that are hidden by the current filters", () => {
    expect(productList.getSelectionVisibilityCounts).toBeTypeOf("function");
    expect(productList.getSelectionVisibilityCounts?.(["visible", "hidden"], ["visible", "other"]))
      .toEqual({ visible: 1, hidden: 1 });
  });

  it("detects when a product filter can be reset", () => {
    expect(productList.hasActiveProductFilters).toBeTypeOf("function");
    expect(productList.hasActiveProductFilters?.("", "all", "all")).toBe(false);
    expect(productList.hasActiveProductFilters?.("latte", "all", "all")).toBe(true);
    expect(productList.hasActiveProductFilters?.("", "coffee", "all")).toBe(true);
    expect(productList.hasActiveProductFilters?.("", "all", "inactive")).toBe(true);
  });

  it("requires confirmation for either bulk status action when products are selected", () => {
    expect(productList.shouldConfirmBulkAction).toBeTypeOf("function");
    expect(productList.shouldConfirmBulkAction?.(2)).toBe(true);
    expect(productList.shouldConfirmBulkAction?.(0)).toBe(false);
  });

  it("requires confirmation before reopening sold-out products", () => {
    expect(productList.shouldConfirmSoldOutReset).toBeTypeOf("function");
    expect(productList.shouldConfirmSoldOutReset?.(3)).toBe(true);
    expect(productList.shouldConfirmSoldOutReset?.(0)).toBe(false);
  });

  it("renders the edit action as a navigation link", () => {
    const editLink = (productList as unknown as Record<string, unknown>).ProductEditLink as ComponentType<{ href: string }>;
    expect(editLink).toBeTypeOf("function");
    const markup = renderToStaticMarkup(createElement(editLink, { href: "/admin/menu/product" }, "แก้ไข"));
    expect(markup).toContain('href="/admin/menu/product"');
    expect(markup).not.toContain('role="button"');
  });
});
