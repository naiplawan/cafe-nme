import { isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  requireStaff: vi.fn(async () => ({ shopId: "shop", staff: { role: "owner" } })),
  getPosMenu: vi.fn(async () => ({ categories: [], products: [] })),
  getShopProfile: vi.fn(async () => ({ slug: "demo-cafe" })),
  getAdminDashboardData: vi.fn(async () => ({ trialSetup: false })),
  publicMenuQr: vi.fn(async () => ({ url: "https://example.test/menu/demo-cafe", image: "data:image/png;base64,AA==" })),
}));

vi.mock("@/lib/auth", () => ({ requireStaff: data.requireStaff }));
vi.mock("@/server/catalog", () => ({ getPosMenu: data.getPosMenu }));
vi.mock("@/server/admin-data", () => ({ getShopProfile: data.getShopProfile, getAdminDashboardData: data.getAdminDashboardData }));
vi.mock("@/server/trial-checkout", () => ({ publicMenuQr: data.publicMenuQr }));

function elements(value: ReactNode): ReactNode[] {
  if (Array.isArray(value)) { return value.flatMap(elements); }
  if (!isValidElement(value)) { return []; }
  return [value, ...elements((value.props as { children?: ReactNode }).children)];
}

function hasProp(element: ReactNode, name: string, expected: string) {
  return isValidElement(element) && (element.props as Record<string, unknown>)[name] === expected;
}

it("links the trial step to its section without using hooks in the async page", async () => {
  const { default: SetupPage } = await import("./page");
  const tree = elements(await SetupPage());
  expect(tree.some((element) => hasProp(element, "href", "#trial-checkout-shop"))).toBe(true);
  expect(tree.some((element) => hasProp(element, "id", "trial-checkout-shop"))).toBe(true);
});
