import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("member stamp adjustment authorization", { skip: !process.env.TEST_DATABASE_URL, concurrency: false }, () => {
  let fixture: PaymentSettingsFixture;
  let service: import("../src/members.service.js").MembersService;
  let memberId: string;

  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    const { MembersService } = await import("../src/members.service.js");
    service = new MembersService(fixture.database as never);
    const [member] = await fixture.database.connection`insert into members(shop_id,display_name,phone)
      values(${fixture.shopId},'Stamp adjustment member','0812345678') returning id::text`;
    memberId = member.id;
  });

  after(async () => { await fixture?.dispose(); });

  it("denies barista, inactive, and foreign-shop staff before changing the ledger", async () => {
    for (const staffId of [fixture.baristaId, fixture.inactiveOwnerId, fixture.otherShopOwnerId]) {
      await assert.rejects(service.adjustStamps(fixture.shopId, memberId, { staffId, delta: 2, note: "Manual correction" }), ForbiddenException);
    }
    const [count] = await fixture.database.connection`select count(*)::int as n from stamp_ledger
      where shop_id=${fixture.shopId} and member_id=${memberId} and reason='adjust'`;
    assert.equal(count.n, 0);
  });

  it("allows an active manager to make an auditable stamp adjustment", async () => {
    const result = await service.adjustStamps(fixture.shopId, memberId, { staffId: fixture.managerId, delta: 2, note: "Manual correction" });
    assert.equal(result.stampBalance, 2);
    const [audit] = await fixture.database.connection`select actor::text as actor from audit_log
      where shop_id=${fixture.shopId} and action='stamps.adjust'`;
    assert.deepEqual(audit, { actor: fixture.managerId });
  });
});
