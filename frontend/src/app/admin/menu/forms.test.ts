import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "@/lib/menu-catalog";
import { ImportStockMenu } from "./forms";

describe("stock menu import", () => {
  it("does not show an unavailable action when all sample items already exist", () => {
    const products = MENU_CATALOG.map(({ name }) => ({ name }));
    const markup = renderToStaticMarkup(createElement(ImportStockMenu, { products }));

    expect(markup).toBe("");
  });
});
