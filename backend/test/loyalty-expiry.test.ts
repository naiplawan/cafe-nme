import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { applyLoyaltyExpiry } from "../src/loyalty-expiry.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL required";
let fixture: PaymentSettingsFixture;
before(async () => {
  if (!databaseUrl) { return; }
  fixture = await createPaymentSettingsFixture(databaseUrl);
});
after(async () => { await fixture?.dispose(); });
async function member() {
  const [row] = await fixture.database.connection<{ id: string }[]>`insert into members (shop_id, display_name) values (${fixture.shopId}::uuid, 'Expiry member') returning id::text as id`;
  return row.id;
}
async function entry(memberId: string, delta: number, createdAt: string, expiresAt: string | null = null, reason = delta > 0 ? "earn" : "redeem") {
  const [row] = await fixture.database.connection<{ id: string }[]>`insert into stamp_ledger (shop_id, member_id, delta, reason, created_at, expires_at)
    values (${fixture.shopId}::uuid, ${memberId}::uuid, ${delta}, ${reason}::stamp_reason, ${createdAt}, ${expiresAt}) returning id::text as id`;
  return row.id;
}
function expire(memberId: string, now = "2026-10-23T00:00:00Z", shopId = fixture.shopId) {
  return fixture.database.connection.begin((tx) => applyLoyaltyExpiry(tx, shopId, memberId, new Date(now)));
}

test("expires only the unspent FIFO remainder and records its source once", { skip }, async () => {
  const id = await member();
  const source = await entry(id, 8, "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");
  await entry(id, -5, "2026-02-01T00:00:00Z");
  await entry(id, 4, "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z");
  const result = await expire(id);
  assert.equal(result?.stampBalance, 4);
  assert.equal(result?.nextStampExpiryAt?.toISOString(), "2027-03-01T00:00:00.000Z");
  await expire(id);
  const rows = await fixture.database.connection`select delta, source_entry_id from stamp_ledger where member_id = ${id}::uuid and reason = 'expire'`;
  assert.deepEqual(rows.map((row) => ({ delta: row.delta, source: row.source_entry_id })), [{ delta: -3, source }]);
});
test("a historical negative adjustment consumes following earnings before later lots", { skip }, async () => {
  const id = await member();
  await entry(id, -4, "2026-01-01T00:00:00Z", null, "adjust");
  await entry(id, 7, "2026-02-01T00:00:00Z", "2026-09-01T00:00:00Z");
  await entry(id, 2, "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z");
  assert.equal((await expire(id))?.stampBalance, 2);
});
test("prior source-specific expiry is never charged to a newer lot", { skip }, async () => {
  const id = await member();
  await entry(id, 6, "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");
  await expire(id, "2026-09-01T00:00:00Z");
  await entry(id, 5, "2026-10-01T00:00:00Z", "2027-10-01T00:00:00Z");
  await entry(id, -2, "2026-10-02T00:00:00Z");
  assert.equal((await expire(id))?.stampBalance, 3);
});
test("concurrent expiry appends one debit and reward expires at the exact deadline", { skip }, async () => {
  const id = await member();
  await entry(id, 5, "2026-01-01T00:00:00Z", "2026-10-23T00:00:00Z");
  await fixture.database.connection`insert into rewards (shop_id, member_id, expires_at) values (${fixture.shopId}::uuid, ${id}::uuid, '2026-10-23T00:00:00Z')`;
  const results = await Promise.all([expire(id), expire(id), expire(id)]);
  assert.deepEqual(results.map((result) => result?.stampBalance), [0, 0, 0]);
  const rows = await fixture.database.connection`select delta from stamp_ledger where member_id = ${id}::uuid and reason = 'expire'`;
  assert.equal(rows.length, 1);
  const [reward] = await fixture.database.connection`select status from rewards where member_id = ${id}::uuid`;
  assert.equal(reward.status, "expired");
});
test("cross-shop requests do not expire another shop's member", { skip }, async () => {
  const id = await member();
  await entry(id, 5, "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");
  const [other] = await fixture.database.connection`select shop_id from staff where id = ${fixture.otherShopOwnerId}::uuid`;
  assert.equal(await expire(id, "2026-10-23T00:00:00Z", other.shop_id), null);
  const [row] = await fixture.database.connection`select sum(delta)::int as balance from stamp_ledger where member_id = ${id}::uuid`;
  assert.equal(row.balance, 5);
});
test("calendar month deadlines clamp at month end in shop timezone", { skip }, async () => {
  const id = await member();
  await fixture.database.connection`update shops set stamp_expiry_months = 1, timezone = 'Asia/Bangkok' where id = ${fixture.shopId}::uuid`;
  const result = await expire(id, "2026-01-31T10:00:00Z");
  assert.equal(result?.newExpiresAt.toISOString(), "2026-02-28T10:00:00.000Z");
});

test("member summary, lookup, list and history enforce expiry before exposing balances", { skip }, async () => {
  const { MembersService } = await import("../src/members.service.js");
  const service = new MembersService(fixture.database as never);
  for (const mode of ["summary", "phone", "list", "ledger"]) {
    const id = await member();
    const phone = `081${id.replace(/\D/g, "").slice(0, 7)}`;
    await fixture.database.connection`update members set phone = ${phone} where id = ${id}::uuid`;
    await entry(id, 4, "2000-01-01T00:00:00Z", "2001-01-01T00:00:00Z");
    if (mode === "summary") { assert.equal((await service.getSummary(fixture.shopId, id))?.stampBalance, 0); }
    if (mode === "phone") { assert.equal((await service.findByPhone(fixture.shopId, phone)).find((row) => row.id === id)?.stampBalance, 0); }
    if (mode === "list") { assert.equal((await service.list(fixture.shopId, {})).rows.find((row) => row.id === id)?.stampBalance, 0); }
    if (mode === "ledger") { assert.ok((await service.listLedger(fixture.shopId, id)).some((row) => row.reason === "expire" && row.delta === -4)); }
  }
});

test("LIFF member reads return expired balance and audit dates", { skip }, async () => {
  const { ConfigService } = await import("@nestjs/config");
  const { LiffService } = await import("../src/liff.service.js");
  const id = await member();
  await fixture.database.connection`update members set phone = '0891112233', line_user_id = ${`U-${id}`} where id = ${id}::uuid`;
  await entry(id, 4, "2000-01-01T00:00:00Z", "2001-01-01T00:00:00Z");
  const [shop] = await fixture.database.connection`select slug from shops where id = ${fixture.shopId}::uuid`;
  const service = new LiffService(fixture.database as never, new ConfigService({ LINE_DEV_MOCK: "1", NODE_ENV: "development" }));
  const card = await service.getMyCard(shop.slug, { idToken: `dev:U-${id}` });
  assert.equal(card.registered, true);
  if (card.registered) {
    assert.equal(card.member.stampBalance, 0);
    assert.equal(card.member.nextStampExpiryAt, null);
    const expiration = card.member.history.find((row) => row.reason === "expire");
    assert.equal(expiration?.delta, -4);
    assert.ok(expiration?.sourceEntryId);
    assert.ok(expiration?.createdAt instanceof Date);
  }
});

test("same-timestamp expiration precedes the checkout's earning and redemption", { skip }, async () => {
  const id = await member();
  await entry(id, 8, "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");
  await expire(id, "2026-10-23T00:00:00Z");
  await fixture.database.connection`insert into stamp_ledger (id, shop_id, member_id, delta, reason, created_at, expires_at)
    values (${`ffffffff-ffff-4fff-8fff-${id.slice(-12)}`}::uuid, ${fixture.shopId}::uuid, ${id}::uuid, 5, 'earn', '2026-10-23T00:00:00Z', '2027-10-23T00:00:00Z'),
      (${`00000000-0000-4000-8000-${id.slice(-12)}`}::uuid, ${fixture.shopId}::uuid, ${id}::uuid, -5, 'redeem', '2026-10-23T00:00:00Z', null)`;
  const result = await expire(id, "2028-10-23T00:00:00Z");
  assert.equal(result?.stampBalance, 0);
  assert.equal(result?.nextStampExpiryAt, null);
});
