import { describe, expect, it } from "vitest";
import { getWrappedTabIndex } from "./dialog-focus";

describe("getWrappedTabIndex", () => {
  it("wraps forward from the last dialog control to the first", () => {
    expect(getWrappedTabIndex(2, 3, false)).toBe(0);
  });

  it("wraps backward from the first dialog control to the last", () => {
    expect(getWrappedTabIndex(0, 3, true)).toBe(2);
  });

  it("leaves focus alone while it remains inside the tab order", () => {
    expect(getWrappedTabIndex(1, 3, false)).toBeNull();
  });
});
