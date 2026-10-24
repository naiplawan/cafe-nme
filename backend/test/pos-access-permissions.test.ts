import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { HttpException } from "@nestjs/common";
import { PosAccessService } from "../src/pos-access.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL is required for PostgreSQL permissions tests";
let fixture: PaymentSettingsFixture;
let service: PosAccessService;
before(async () => {
  if (!databaseUrl) { return; }
  fixture = await createPaymentSettingsFixture(databaseUrl);
  service = new PosAccessService(fixture.database as never);
});
after(async () => { await fixture?.dispose(); });

async function snapshot() {
  return fixture.database.connection`
    select id, role, pin_hash, is_active from staff
    where shop_id = ${fixture.shopId}::uuid or id = ${fixture.otherShopOwnerId}::uuid order by id
  `;
}
async function denied(operation: () => Promise<unknown>) {
  const before = await snapshot();
  // biome-ignore lint/suspicious/noMisplacedAssertion: Shared rejection and persistence assertion called only from tests.
  await assert.rejects(operation, (error: unknown) => error instanceof HttpException && [403, 404, 409].includes(error.getStatus()));
  // biome-ignore lint/suspicious/noMisplacedAssertion: Shared rejection and persistence assertion called only from tests.
  assert.deepEqual(await snapshot(), before);
}

test("manager cannot create an owner", { skip }, async () => {
  await denied(() => service.createStaff(fixture.shopId, fixture.managerId, { name: "Escalated", role: "owner", pin: "1234" }));
});
test("manager cannot reset an owner's PIN", { skip }, async () => {
  await denied(() => service.setStaffPin(fixture.shopId, fixture.managerId, fixture.ownerId, "1234"));
});
test("manager cannot activate an inactive owner", { skip }, async () => {
  await denied(() => service.setStaffActive(fixture.shopId, fixture.managerId, fixture.inactiveOwnerId, true));
});
test("owner and manager create only roles at or below their authority", { skip }, async () => {
  for (const [actorId, role] of [[fixture.ownerId, "owner"], [fixture.ownerId, "manager"], [fixture.ownerId, "barista"], [fixture.managerId, "manager"], [fixture.managerId, "barista"]]) {
    const created = await service.createStaff(fixture.shopId, actorId, { name: "Allowed", role, pin: "1234" });
    const [row] = await fixture.database.connection`select role, shop_id, pin_hash from staff where id = ${created.id}::uuid`;
    assert.equal(row.role, role);
    assert.equal(row.shop_id, fixture.shopId);
    assert.match(row.pin_hash, /^scrypt\$/);
  }
});
test("owner can reset owner PIN and manager can reset barista PIN", { skip }, async () => {
  for (const [actorId, targetId] of [[fixture.ownerId, fixture.ownerId], [fixture.managerId, fixture.baristaId]]) {
    const before = await fixture.database.connection`select pin_hash from staff where id = ${targetId}::uuid`;
    await service.setStaffPin(fixture.shopId, actorId, targetId, "5678");
    const after = await fixture.database.connection`select pin_hash from staff where id = ${targetId}::uuid`;
    assert.notEqual(after[0].pin_hash, before[0].pin_hash);
    assert.match(after[0].pin_hash, /^scrypt\$/);
  }
});
test("owner activity and self-disable protections persist", { skip }, async () => {
  await denied(() => service.setStaffActive(fixture.shopId, fixture.ownerId, fixture.ownerId, false));
  await denied(() => service.setStaffActive(fixture.shopId, fixture.managerId, fixture.ownerId, false));
  await denied(() => service.setStaffActive(fixture.shopId, fixture.managerId, fixture.managerId, false));
  await service.setStaffActive(fixture.shopId, fixture.ownerId, fixture.inactiveOwnerId, true);
  await service.setStaffActive(fixture.shopId, fixture.managerId, fixture.baristaId, false);
  await service.setStaffActive(fixture.shopId, fixture.managerId, fixture.baristaId, true);
  const [row] = await fixture.database.connection`select is_active from staff where id = ${fixture.baristaId}::uuid`;
  assert.equal(row.is_active, true);
});
test("barista and cross-shop actors cannot mutate staff", { skip }, async () => {
  for (const actorId of [fixture.baristaId, fixture.otherShopOwnerId]) {
    await denied(() => service.createStaff(fixture.shopId, actorId, { name: "Denied", role: "barista", pin: "1234" }));
    await denied(() => service.setStaffPin(fixture.shopId, actorId, fixture.managerId, "1234"));
    await denied(() => service.setStaffActive(fixture.shopId, actorId, fixture.managerId, false));
  }
});
test("cross-shop targets cannot be changed", { skip }, async () => {
  await denied(() => service.setStaffPin(fixture.shopId, fixture.ownerId, fixture.otherShopOwnerId, "1234"));
  for (const active of [true, false]) {
    await denied(() => service.setStaffActive(fixture.shopId, fixture.ownerId, fixture.otherShopOwnerId, active));
  }
});
