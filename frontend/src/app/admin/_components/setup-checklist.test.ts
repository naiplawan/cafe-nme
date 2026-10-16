import { describe, expect, it } from "vitest";
import * as setupChecklist from "./setup-checklist";

describe("setup checklist by role", () => {
  it("limits baristas to setup actions they can access", () => {
    expect(setupChecklist.setupStepKeysForRole).toBeTypeOf("function");
    expect(setupChecklist.setupStepKeysForRole("barista")).toEqual(["menu", "modifiers"]);
  });

  it("shows the full setup plan to managers and owners", () => {
    expect(setupChecklist.setupStepKeysForRole("owner")).toEqual(["menu", "modifiers", "ownerPin", "device", "line", "brand"]);
    expect(setupChecklist.setupStepKeysForRole("manager")).toEqual(["menu", "modifiers", "ownerPin", "device", "line", "brand"]);
  });
});
