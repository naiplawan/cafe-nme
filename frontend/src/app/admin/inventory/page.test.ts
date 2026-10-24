import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ staff: vi.fn(), inventory: vi.fn(), subscription: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireStaff: api.staff }));
vi.mock("@/server/inventory", () => ({ listInventory: api.inventory }));
vi.mock("@/server/subscriptions", () => ({ getSubscription: api.subscription }));

beforeEach(() => {
  vi.clearAllMocks();
  api.staff.mockResolvedValue({ shopId: "shop", userId: "user", staff: { id: "owner", role: "owner" } });
  api.inventory.mockResolvedValue({
    ingredients: [{ id: "11111111-1111-4111-8111-111111111111", name: "นม", unit: "ml", lowStockMilliunits: 1000, onHandMilliunits: 0, lowStock: true }],
    targets: [], recipes: [], movements: [],
  });
});

it("lets an expired-plan owner receive stock but hides Pro-only movement choices and recipe editing", async () => {
  api.subscription.mockResolvedValue({ allowedFeatures: [] });
  const { default: InventoryPage } = await import("./page");
  const markup = renderToStaticMarkup(await InventoryPage());

  expect(markup).toContain("รับวัตถุดิบเข้าได้");
  expect(markup).toContain('name="kind" value="receive"');
  expect(markup).not.toContain("ของเสีย / หก");
  expect(markup).not.toContain("ปรับยอด (+ / −)");
  expect(markup).not.toContain("สูตรวัตถุดิบ");
  expect(markup).not.toContain("name=\"threshold\"");
});
