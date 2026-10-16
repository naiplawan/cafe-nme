import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Select, SelectTrigger } from "./select";

describe("shared touch targets", () => {
  it("keeps standard and compact buttons at least 44px tall", () => {
    expect(buttonVariants({ size: "default" })).toContain("min-h-11");
    expect(buttonVariants({ size: "sm" })).toContain("min-h-11");
  });

  it("keeps icon buttons large enough to tap", () => {
    expect(buttonVariants({ size: "icon" })).toContain("size-11");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-11");
  });

  it("renders inputs with a 44px minimum height", () => {
    const markup = renderToStaticMarkup(createElement(Input, { "aria-label": "ค้นหา" }));
    expect(markup).toContain("min-h-11");
  });

  it("gives checkboxes at least a 44px effective hit area", () => {
    const markup = renderToStaticMarkup(createElement(Checkbox, { "aria-label": "เลือกสินค้า" }));
    expect(markup).toContain("size-5");
    expect(markup).toContain("after:-inset-3");
  });

  it("keeps select triggers at least 44px tall", () => {
    const select = createElement(Select, null, createElement(SelectTrigger, null, "ตัวเลือก"));
    expect(renderToStaticMarkup(select)).toContain("min-h-11");
  });
});
