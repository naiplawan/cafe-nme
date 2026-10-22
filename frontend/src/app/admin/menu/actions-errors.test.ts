import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ createProduct: vi.fn(), updateMenuSettings: vi.fn(), deleteCategory: vi.fn() }));
vi.mock("@/server/menu", () => api);
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ requireStaff: async () => ({ shopId: "shop" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { createProductAction, deleteCategoryAction, setAutoClearSoldOutAction } from "./actions";
afterEach(() => vi.resetAllMocks());
it("preserves product inputs when saving fails", async () => {
  api.createProduct.mockRejectedValue(new Error("offline"));
  const data = new FormData();
  data.set("name", "Coffee"); data.set("price", "50.50");
  const result = await createProductAction({ message: null }, data);
  expect(result.success).not.toBe(true);
  expect(result.message).toBeTruthy();
  expect(result.values).toMatchObject({ name: "Coffee", price: "50.50" });
});
it("returns an actionable failure for settings and deletion", async () => {
  api.updateMenuSettings.mockRejectedValue(new Error("offline"));
  api.deleteCategory.mockRejectedValue(new Error("offline"));
  await expect(setAutoClearSoldOutAction(false)).resolves.toMatchObject({ success: false, message: expect.any(String) });
  await expect(deleteCategoryAction("11111111-1111-4111-8111-111111111111", { message: null }, new FormData())).resolves.toMatchObject({ success: false, message: expect.any(String) });
});
