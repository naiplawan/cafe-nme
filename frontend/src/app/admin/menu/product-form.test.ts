import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductForm } from "./forms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("./actions", () => ({}));

const categories = [{ id: "c1", name: "กาแฟ" }];
const modifierGroups = [{ id: "g1", name: "ความหวาน", minSelect: 1, maxSelect: 1, modifierNames: ["50%"] }];

function render() {
  return renderToStaticMarkup(createElement(ProductForm, {
    categories,
    modifierGroups,
    action: async (state) => state,
    submitLabel: "เพิ่มสินค้า",
  }));
}

describe("product form sections", () => {
  it("renders every field in one form", () => {
    const markup = render();
    for (const name of ["name", "price", "categoryId", "modifierGroupIds", "imageUrl", "earnsStamp", "isActive"]) {
      expect(markup).toContain(`name="${name}"`);
    }
  });

  it("keeps every section visible so the browser can point at any invalid field", () => {
    const markup = render();
    expect(markup).not.toContain("hidden=\"\"><");
    expect(markup.match(/<section id="[^"]+-section-/g)).toHaveLength(4);
  });

  it("links each jump link to its section", () => {
    const markup = render();
    const targets = [...markup.matchAll(/<a href="#([^"]+)"/g)].map((match) => match[1]);
    expect(targets).toHaveLength(4);
    for (const id of targets) expect(markup).toContain(`<section id="${id}"`);
  });
});
