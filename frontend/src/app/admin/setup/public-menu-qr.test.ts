import { expect, it } from "vitest";
import { publicMenuUrl } from "@/server/trial-checkout";
it("builds a public shop menu URL independent of LINE", () => {
  expect(publicMenuUrl("coffee-shop", "https://cafe.example/")).toBe("https://cafe.example/menu/coffee-shop");
});
it("rejects unsafe or non-origin configuration instead of leaking credentials", () => {
  for (const origin of ["javascript:alert(1)", "https://secret:password@cafe.example", "https://cafe.example/?token=secret", "https://cafe.example/path", "https://cafe.example/#secret"]) {
    expect(() => publicMenuUrl("coffee", origin)).toThrow();
  }
  expect(() => publicMenuUrl("../another-shop", "https://cafe.example")).toThrow();
});
