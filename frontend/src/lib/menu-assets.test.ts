import { describe, expect, it } from "vitest";
import { legacyProductImageSrc, menuAssetObjectKey, menuImageSrc } from "./menu-catalog";

describe("menu asset storage paths", () => {
  it("uses the Railway-backed route for catalog images", () => {
    expect(menuImageSrc("espresso")).toBe("/api/menu-assets/menu/espresso.webp");
  });

  it("serves only known catalog and legacy menu assets", () => {
    expect(menuAssetObjectKey(["menu", "espresso.webp"])).toBe("menu/espresso.webp");
    expect(menuAssetObjectKey(["product-americano.png"])).toBe("product-americano.png");
    expect(menuAssetObjectKey(["menu", "unknown.webp"])).toBeNull();
    expect(menuAssetObjectKey(["..", "secrets.txt"])).toBeNull();
  });

  it("uses the Railway-backed route for legacy seed product images", () => {
    expect(legacyProductImageSrc("product-americano.png")).toBe("/api/menu-assets/product-americano.png");
  });
});
