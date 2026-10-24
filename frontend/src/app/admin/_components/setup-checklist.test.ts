import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as setupChecklist from "./setup-checklist";

describe("setup checklist by role", () => {
  it("limits baristas to setup actions they can access", () => {
    expect(setupChecklist.setupStepKeysForRole).toBeTypeOf("function");
    expect(setupChecklist.setupStepKeysForRole("barista")).toEqual(["menu", "modifiers"]);
  });

  it("shows the full setup plan to managers and owners", () => {
    expect(setupChecklist.setupStepKeysForRole("owner")).toEqual(["menu", "modifiers", "ownerPin", "device", "promptpay", "line", "trial", "brand"]);
    expect(setupChecklist.setupStepKeysForRole("manager")).toEqual(["menu", "modifiers", "ownerPin", "device", "line", "trial", "brand"]);
  });

  it("keeps the owner-only PromptPay link out of manager and barista checklists", () => {
    expect(setupChecklist.setupStepKeysForRole("manager")).not.toContain("promptpay");
    expect(setupChecklist.setupStepKeysForRole("barista")).not.toContain("promptpay");
  });
});

it("keeps setup visible until an owner or manager runs the required trial", () => {
  const steps = { menu: true, modifiers: true, ownerPin: true, device: true, line: true, brand: true, promptpay: true, trial: false };
  for (const role of ["owner", "manager"] as const) {
    const html = renderToStaticMarkup(createElement(setupChecklist.SetupChecklist, { steps, role }));
    expect(html).toContain('href="/admin/setup"');
    expect(html).toContain("ทดลองออกบิล");
  }
  expect(renderToStaticMarkup(createElement(setupChecklist.SetupChecklist, { steps, role: "barista" }))).not.toContain('href="/admin/setup"');
});
