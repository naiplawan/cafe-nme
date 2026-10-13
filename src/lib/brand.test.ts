import { describe, expect, it } from "vitest";
import { BRAND_PRESETS, brandVars, contrastRatio, DEFAULT_ACCENT, INK, normalizeHex, onAccent, sniffImageMime, WHITE } from "./brand";

describe("normalizeHex", () => {
  it.each([
    ["#abc", "#AABBCC"],
    ["abc", "#AABBCC"],
    [" #5e7a3a ", "#5E7A3A"],
    ["#5E7A3A", "#5E7A3A"],
  ])("%s → %s", (input, expected) => expect(normalizeHex(input)).toBe(expected));

  it.each(["", "#12", "#12345", "#GGGGGG", "red", "#1234567"])("rejects %s", (input) => expect(normalizeHex(input)).toBeNull());
});

describe("contrast", () => {
  it("matches WCAG extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("picks the more readable text colour", () => {
    expect(onAccent("#2B2B28")).toBe(WHITE);
    expect(onAccent("#FFD449")).toBe(INK);
  });

  it("every preset gives at least 4.5:1 for its text colour", () => {
    for (const preset of BRAND_PRESETS) expect(contrastRatio(preset.accent, onAccent(preset.accent))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("brandVars", () => {
  it("falls back to the default accent", () => {
    expect(brandVars(null)["--brand"]).toBe(DEFAULT_ACCENT);
    expect(brandVars("nope")["--brand"]).toBe(DEFAULT_ACCENT);
  });

  it("normalises a custom accent", () => expect(brandVars("5e7a3a")).toEqual({ "--brand": "#5E7A3A", "--brand-fg": WHITE }));
});

describe("sniffImageMime", () => {
  it("detects png, jpeg and webp", () => {
    expect(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });

  it("rejects svg and garbage", () => {
    expect(sniffImageMime(new TextEncoder().encode("<svg xmlns"))).toBeNull();
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });
});
