import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ModifierFormState } from "./actions";
import { ModifierGroupForm } from "./modifier-forms";

const noOpGroupAction = async (state: ModifierFormState) => state;

describe("modifier group form", () => {
  it("renders an existing minimum selection greater than one without lowering it", () => {
    const markup = renderToStaticMarkup(createElement(ModifierGroupForm, {
      action: noOpGroupAction,
      group: { id: "group-1", name: "ท็อปปิ้ง", minSelect: 2, maxSelect: 3 },
    }));

    expect(markup).toContain('name="minSelect"');
    expect(markup).toContain('name="maxSelect"');
    expect(markup).toContain('value="2"');
    expect(markup).toContain('value="3"');
    expect(markup).toContain("0 = ไม่บังคับ");
  });
});
