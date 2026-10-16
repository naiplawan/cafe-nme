import { describe, expect, it } from "vitest";
import * as navigation from "./navigation";

describe("admin navigation by role", () => {
  it("exposes a role-aware navigation model", () => {
    expect(navigation.adminNavigationForRole).toBeTypeOf("function");
    const paths = navigation.adminNavigationForRole("barista").flatMap((section) => section.links.map((link) => link.href));
    expect(paths).toContain("/admin/menu");
    expect(paths).not.toContain("/admin/staff");
    expect(paths).not.toContain("/admin/devices");
    expect(paths).not.toContain("/admin/line");
    expect(paths).not.toContain("/admin/brand");
  });
});
