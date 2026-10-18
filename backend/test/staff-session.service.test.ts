import assert from "node:assert/strict";
import test from "node:test";
import { StaffSessionService } from "../src/staff-session.service.js";

function serviceWithRows(rows: unknown[]) {
  const calls: string[] = [];
  const connection = async (strings: TemplateStringsArray) => {
    calls.push(strings.join(" ").replace(/\s+/g, " ").trim());
    return rows;
  };
  return { service: new StaffSessionService({ connection } as never), calls };
}

test("lists each active shop membership with that shop's staff role", async () => {
  const { service } = serviceWithRows([
    { staff_id: "staff-1", staff_name: "Owner North", staff_role: "owner", shop_id: "shop-1", shop_name: "North" },
    { staff_id: "staff-2", staff_name: "Manager South", staff_role: "manager", shop_id: "shop-2", shop_name: "South" },
  ]);

  assert.deepEqual(await service.listByAuthUserId("user-1"), [
    { staff: { id: "staff-1", name: "Owner North", role: "owner" }, shop: { id: "shop-1", name: "North" }, shopId: "shop-1" },
    { staff: { id: "staff-2", name: "Manager South", role: "manager" }, shop: { id: "shop-2", name: "South" }, shopId: "shop-2" },
  ]);
});

test("resolves a selected shop only from the user's active membership", async () => {
  const { service, calls } = serviceWithRows([
    { staff_id: "staff-2", staff_name: "Manager South", staff_role: "manager", shop_id: "shop-2", shop_name: "South" },
  ]);

  assert.deepEqual(await service.getByAuthUserIdAndShopId("user-1", "shop-2"), {
    staff: { id: "staff-2", name: "Manager South", role: "manager" },
    shop: { id: "shop-2", name: "South" },
    shopId: "shop-2",
  });
  assert.match(calls[0], /s\.auth_user_id =/);
  assert.match(calls[0], /s\.shop_id =/);
  assert.match(calls[0], /s\.is_active = true/);
});

test("returns no selected session for a shop without an active membership", async () => {
  const { service } = serviceWithRows([]);
  assert.equal(await service.getByAuthUserIdAndShopId("user-1", "other-shop"), null);
});
