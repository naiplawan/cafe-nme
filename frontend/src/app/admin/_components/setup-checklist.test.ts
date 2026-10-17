import { describe, expect, it } from "vitest";
import * as setupChecklist from "./setup-checklist";

describe("setup checklist by role", () => {
  it("limits baristas to setup actions they can access", () => {
    expect(setupChecklist.setupStepKeysForRole).toBeTypeOf("function");
    expect(setupChecklist.setupStepKeysForRole("barista")).toEqual(["menu", "modifiers"]);
  });

  it("shows the full setup plan to managers and owners", () => {
    expect(setupChecklist.setupStepKeysForRole("owner")).toEqual(["menu", "modifiers", "ownerPin", "device", "line", "brand", "promptpay"]);
    expect(setupChecklist.setupStepKeysForRole("manager")).toEqual(["menu", "modifiers", "ownerPin", "device", "line", "brand"]);
  });

  it("keeps the owner-only PromptPay link out of manager and barista checklists", () => {
    expect(setupChecklist.setupStepKeysForRole("manager")).not.toContain("promptpay");
    expect(setupChecklist.setupStepKeysForRole("barista")).not.toContain("promptpay");
  });
});
