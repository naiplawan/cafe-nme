import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ createIngredient: vi.fn(), moveInventory: vi.fn(), saveRecipe: vi.fn(), setInventoryThreshold: vi.fn(), session: vi.fn() }));
vi.mock("@/server/inventory", () => api);
vi.mock("@/lib/auth", () => ({ requireStaff: api.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
const ingredientId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ shopId: "shop", staff: { id: "manager", role: "manager" } });
});
it("converts signed adjustments to exact milliunits and ignores client actor scope", async () => {
  const { moveInventoryAction } = await import("./actions");
  const form = new FormData();
  form.set("ingredientId", ingredientId); form.set("requestId", targetId);
  form.set("kind", "adjust"); form.set("quantity", "-0.001"); form.set("reason", "Stock count");
  form.set("shopId", "foreign");
  expect(await moveInventoryAction(null, form)).toMatchObject({ success: true });
  expect(api.moveInventory).toHaveBeenCalledWith("shop", "manager", ingredientId,
    { requestId: targetId, kind: "adjust", quantityMilliunits: -1, reason: "Stock count" });
});
it("rejects excessive precision and unauthorized mutation", async () => {
  const { moveInventoryAction } = await import("./actions");
  const form = new FormData();
  form.set("ingredientId", ingredientId); form.set("requestId", targetId);
  form.set("kind", "receive"); form.set("quantity", "0.0001"); form.set("reason", "Delivery");
  expect(await moveInventoryAction(null, form)).toMatchObject({ success: false });
  api.session.mockResolvedValue({ shopId: "shop", staff: { id: "staff", role: "barista" } });
  form.set("quantity", "1");
  expect(await moveInventoryAction(null, form)).toMatchObject({ success: false });
  expect(api.moveInventory).not.toHaveBeenCalled();
});
it("saves nonzero recipe quantities while allowing omitted ingredients to remove lines", async () => {
  const { saveRecipeAction } = await import("./actions");
  const form = new FormData(); form.set("kind", "product"); form.set("targetId", targetId);
  form.set(`quantity:${ingredientId}`, "18.005");
  form.set("quantity:33333333-3333-4333-8333-333333333333", "0");
  expect(await saveRecipeAction(null, form)).toMatchObject({ success: true });
  expect(api.saveRecipe).toHaveBeenCalledWith("shop", "manager", "product", targetId,
    [{ ingredientId, quantityMilliunits: 18005 }]);
});
