import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "@/lib/menu-catalog";
import { addProductHref, ImportStockMenu } from "./forms";

describe("stock menu import", () => {
  it("does not show an unavailable action when all sample items already exist", () => {
    const products = MENU_CATALOG.map(({ name }) => ({ name }));
    const markup = renderToStaticMarkup(createElement(ImportStockMenu, { products }));

    expect(markup).toBe("");
  });
});

describe("add product navigation", () => {
  it("builds the canonical products URL with the add state and existing filters", () => {
    const search = new URLSearchParams({ step: "products", q: "latte", category: "c1", status: "soldOut" }).toString();
    const expected = `/admin/menu?${new URLSearchParams({ step: "products", q: "latte", category: "c1", status: "soldOut", add: "1" }).toString()}`;
    expect(addProductHref(`?${search}`)).toBe(expected);
  });
});
