import { describe, expect, it } from "vitest";
import { formatOrderTime } from "./format";

describe("formatOrderTime", () => {
  it("shows the order time in Bangkok even when the server date is UTC", () => {
    expect(formatOrderTime(new Date("2026-10-13T07:32:00.000Z"))).toBe("14:32");
  });
});
