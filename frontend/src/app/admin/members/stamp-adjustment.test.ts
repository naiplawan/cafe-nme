import { describe, expect, it } from "vitest";
import { projectedStampBalance } from "./stamp-adjustment";

describe("stamp adjustment preview", () => {
  it("projects only a whole-number adjustment", () => {
    expect(projectedStampBalance(7, "3")).toBe(10);
    expect(projectedStampBalance(7, "-2")).toBe(5);
    expect(projectedStampBalance(7, "1.5")).toBeNull();
    expect(projectedStampBalance(7, "")).toBeNull();
  });
});
