import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductEditLink } from "./product-list";

describe("product edit link", () => {
  it("names the product for assistive technology", () => {
    const markup = renderToStaticMarkup(createElement(ProductEditLink, { href: "/admin/menu/p1", name: "ลาเต้" }));
    expect(markup).toContain('aria-label="แก้ไข ลาเต้"');
    expect(markup).toContain(">แก้ไข</a>");
  });
});
