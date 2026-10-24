import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import {
  LoyaltyGroupsService,
  resolveSharedLoyalty,
  consumeSharedStamps,
  redeemSharedReward,
  restoreOrderSharedStamps,
} from '../src/loyalty-groups.service.js';
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from './payment-settings-fixture.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : 'TEST_DATABASE_URL required';
let fixture: PaymentSettingsFixture;
let service: LoyaltyGroupsService;
let otherShopId: string;
let userId: string;
before(async () => {
  if (!databaseUrl) {
    return;
  }
  fixture = await createPaymentSettingsFixture(databaseUrl);
  service = new LoyaltyGroupsService(fixture.database as never);
  const sql = fixture.database.connection;
  const [user] = await sql<
    { id: string }[]
  >`insert into users (email,password_hash) values (${`${randomUUID()}@groups.test`}, 'test') returning id::text as id`;
  userId = user.id;
  await sql`update staff set auth_user_id = ${userId}::uuid where id in (${fixture.ownerId}::uuid, ${fixture.otherShopOwnerId}::uuid)`;
  const [other] = await sql`select shop_id from staff where id = ${fixture.otherShopOwnerId}::uuid`;
  otherShopId = other.shop_id;
});
after(async () => {
  if (!fixture) {
    return;
  }
  await fixture.database.connection`delete from loyalty_groups where created_by = ${userId}::uuid`;
  await fixture.database.connection`delete from users where id = ${userId}::uuid`;
  await fixture.dispose();
});
test('rejects a manager and owner without owner access to every selected branch', { skip }, async () => {
  await assert.rejects(
    service.create(fixture.shopId, fixture.managerId, { name: 'Branches', shopIds: [fixture.shopId, otherShopId] }),
    HttpException,
  );
  await fixture.database.connection`update staff set is_active = false where id = ${fixture.otherShopOwnerId}::uuid`;
  await assert.rejects(
    service.create(fixture.shopId, fixture.ownerId, { name: 'Branches', shopIds: [fixture.shopId, otherShopId] }),
    HttpException,
  );
  await fixture.database.connection`update staff set is_active = true where id = ${fixture.otherShopOwnerId}::uuid`;
});
test('rejects branches with different stamp policies', { skip }, async () => {
  await fixture.database.connection`update shops set stamp_goal = 20 where id = ${otherShopId}::uuid`;
  await assert.rejects(
    service.create(fixture.shopId, fixture.ownerId, { name: 'Branches', shopIds: [fixture.shopId, otherShopId] }),
    HttpException,
  );
  await fixture.database.connection`update shops set stamp_goal = 10 where id = ${otherShopId}::uuid`;
});
test('creates only explicitly selected branches and prevents regrouping', { skip }, async () => {
  const result = await service.create(fixture.shopId, fixture.ownerId, {
    name: 'Branches',
    shopIds: [fixture.shopId, otherShopId],
  });
  assert.ok(result.id);
  const rows = await fixture.database
    .connection`select shop_id from loyalty_group_shops where group_id = ${result.id}::uuid`;
  assert.deepEqual(new Set(rows.map((row) => row.shop_id)), new Set([fixture.shopId, otherShopId]));
  await assert.rejects(
    service.create(fixture.shopId, fixture.ownerId, { name: 'Again', shopIds: [fixture.shopId, otherShopId] }),
    HttpException,
  );
});

async function aliases() {
  const lineId = `U-${randomUUID()}`;
  const sql = fixture.database.connection;
  const rows = await sql<{ id: string; shopId: string }[]>`insert into members (shop_id,display_name,line_user_id)
    values (${fixture.shopId}::uuid,'Shared member',${lineId}), (${otherShopId}::uuid,'Shared member',${lineId}) returning id::text as id, shop_id::text as "shopId"`;
  const local = rows.find((row) => row.shopId === fixture.shopId);
  const other = rows.find((row) => row.shopId === otherShopId);
  if (!local || !other) {
    throw new Error('Fixture members missing');
  }
  await sql`insert into stamp_ledger (shop_id,member_id,delta,reason,expires_at,created_at)
    values (${fixture.shopId}::uuid,${local.id}::uuid,4,'earn','2027-01-01T00:00:00Z','2026-01-01T00:00:00Z'),
      (${otherShopId}::uuid,${other.id}::uuid,6,'earn','2028-01-01T00:00:00Z','2026-02-01T00:00:00Z')`;
  const [order] = await sql<
    { id: string }[]
  >`insert into orders (shop_id,daily_no,business_date,status,staff_id,member_id,subtotal_satang,discount_satang,total_satang)
    values (${fixture.shopId}::uuid,${Math.floor(Math.random() * 100000000)},'2026-10-23','paid',${fixture.ownerId}::uuid,${local.id}::uuid,100,0,100) returning id::text as id`;
  return { local: local.id, other: other.id, orderId: order.id, lineId };
}
test('shared consumption debits origin lots and cannot expire the same points twice', { skip }, async () => {
  const data = await aliases();
  await fixture.database.connection.begin(async (tx) => {
    const scope = await resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2026-10-23T00:00:00Z'));
    assert.equal(scope?.stampBalance, 10);
    assert.ok(scope);
    await consumeSharedStamps(tx, scope, 10, data.orderId, fixture.ownerId);
    const current = await resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2029-01-01T00:00:00Z'));
    assert.equal(current?.stampBalance, 0);
  });
  const debits = await fixture.database
    .connection`select shop_id,delta,source_entry_id from stamp_ledger where order_id=${data.orderId}::uuid and reason='redeem'`;
  assert.equal(debits.length, 2);
  assert.deepEqual(new Set(debits.map((row) => row.shop_id)), new Set([fixture.shopId, otherShopId]));
  assert.ok(debits.every((row) => row.source_entry_id));
});
test('concurrent redemption across two branches uses one reward exactly once and keeps issuer', { skip }, async () => {
  const data = await aliases();
  const [reward] = await fixture.database.connection<
    { id: string }[]
  >`insert into rewards(shop_id,member_id,expires_at) values(${fixture.shopId}::uuid,${data.local}::uuid,'2027-01-01T00:00:00Z') returning id::text as id`;
  const [otherOrder] = await fixture.database.connection<
    { id: string }[]
  >`insert into orders(shop_id,daily_no,business_date,status,staff_id,member_id,subtotal_satang,discount_satang,total_satang)
    values(${otherShopId}::uuid,1,'2026-10-23','paid',${fixture.otherShopOwnerId}::uuid,${data.other}::uuid,100,0,100) returning id::text as id`;
  const results = await Promise.all(
    [
      [fixture.shopId, data.local],
      [otherShopId, data.other],
    ].map(([shopId, memberId]) =>
      fixture.database.connection.begin(async (tx) => {
        const scope = await resolveSharedLoyalty(tx, shopId, memberId, new Date('2026-10-23T00:00:00Z'));
        assert.ok(scope);
        const available = scope.availableRewards.find((row) => row.id === reward.id);
        if (available) {
          assert.equal(available.issuerShopId, fixture.shopId);
        }
        return redeemSharedReward(tx, scope, reward.id, shopId === fixture.shopId ? data.orderId : otherOrder.id);
      }),
    ),
  );
  assert.equal(results.filter(Boolean).length, 1);
  const [saved] = await fixture.database.connection`select shop_id,status from rewards where id=${reward.id}::uuid`;
  assert.equal(saved.shop_id, fixture.shopId);
  assert.equal(saved.status, 'redeemed');
});
test('partial restorations are capped, idempotent and preserve each original expiry', { skip }, async () => {
  const data = await aliases();
  await fixture.database.connection.begin(async (tx) => {
    const scope = await resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2026-10-23T00:00:00Z'));
    assert.ok(scope);
    await consumeSharedStamps(tx, scope, 10, data.orderId, fixture.ownerId);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'partial-a', 4), 4);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'partial-a', 4), 4);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'partial-b', 6), 6);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'partial-c', 10), 0);
  });
  const restored = await fixture.database
    .connection`select delta,expires_at from stamp_ledger where order_id=${data.orderId}::uuid and reason='adjust' order by expires_at`;
  assert.deepEqual(
    restored.map((row) => row.delta),
    [4, 6],
  );
  assert.deepEqual(
    restored.map((row) => row.expires_at.toISOString()),
    ['2027-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z'],
  );
});
test('phone-only members stay local and an outside shop cannot use grouped rewards', { skip }, async () => {
  const data = await aliases();
  await fixture.database
    .connection`update members set line_user_id=null,phone='0819992222' where id in (${data.local}::uuid,${data.other}::uuid)`;
  const scope = await fixture.database.connection.begin((tx) =>
    resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2026-10-23T00:00:00Z')),
  );
  assert.equal(scope?.stampBalance, 4);
  assert.equal(scope?.aliases.length, 1);
  assert.equal(
    await fixture.database.connection.begin((tx) => resolveSharedLoyalty(tx, otherShopId, data.local)),
    null,
  );
});
test('restoration never revives consumed points whose original expiry has passed', { skip }, async () => {
  const data = await aliases();
  await fixture.database.connection.begin(async (tx) => {
    const scope = await resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2026-10-23T00:00:00Z'));
    assert.ok(scope);
    await consumeSharedStamps(tx, scope, 10, data.orderId, fixture.ownerId);
  });
  await fixture.database.connection.begin(async (tx) => {
    const scope = await resolveSharedLoyalty(tx, fixture.shopId, data.local, new Date('2027-06-01T00:00:00Z'));
    assert.ok(scope);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'expired-a', 4), 0);
    assert.equal(await restoreOrderSharedStamps(tx, scope, data.orderId, fixture.ownerId, 'expired-b', 6), 6);
  });
});
async function checkoutFixture() {
  const { OrdersService } = await import('../src/orders.service.js');
  const data = await aliases();
  const sql = fixture.database.connection;
  await sql`delete from stamp_ledger where member_id in (${data.local}::uuid,${data.other}::uuid)`;
  await sql`update shops set promptpay_id='0812345678' where id in (${fixture.shopId}::uuid,${otherShopId}::uuid)`;
  const products = await sql<
    { id: string; shopId: string }[]
  >`insert into products(shop_id,name,base_price_satang,earns_stamp) values(${fixture.shopId}::uuid,'Coffee',1000,true),(${otherShopId}::uuid,'Coffee',1000,true) returning id::text as id,shop_id::text as "shopId"`;
  const orders = new OrdersService(fixture.database as never);
  const buy = (shopId: string, qty: number, rewardId?: string) =>
    orders.checkout(shopId, shopId === fixture.shopId ? fixture.ownerId : fixture.otherShopOwnerId, {
      requestId: randomUUID(),
      memberId: shopId === fixture.shopId ? data.local : data.other,
      redeemRewardId: rewardId,
      lines: [{ productId: products.find((row) => row.shopId === shopId)?.id ?? '', qty, modifierIds: [] }],
      payment: { method: 'promptpay' },
    });
  return { ...data, orders, buy };
}
test('real two-branch checkout combines earnings and concurrent reward use succeeds once', { skip }, async () => {
  const data = await checkoutFixture();
  assert.equal((await data.buy(fixture.shopId, 4)).rewardsCreated, 0);
  const earned = await data.buy(otherShopId, 6);
  assert.equal(earned.rewardsCreated, 1);
  const [reward] = await fixture.database
    .connection`select id,shop_id from rewards where earned_order_id=${earned.orderId}::uuid`;
  assert.equal(reward.shop_id, otherShopId);
  const uses = await Promise.allSettled([data.buy(fixture.shopId, 1, reward.id), data.buy(otherShopId, 1, reward.id)]);
  assert.equal(uses.filter((row) => row.status === 'fulfilled').length, 1);
  const paid = uses.find((row) => row.status === 'fulfilled');
  assert.ok(paid && paid.status === 'fulfilled');
  const [saved] = await fixture.database.connection`select shop_id from orders where id=${paid.value.orderId}::uuid`;
  await data.orders.voidOrder(
    saved.shop_id,
    paid.value.orderId,
    saved.shop_id === fixture.shopId ? fixture.ownerId : fixture.otherShopOwnerId,
  );
  const [restored] = await fixture.database.connection`select status,shop_id from rewards where id=${reward.id}::uuid`;
  assert.equal(restored.status, 'available');
  assert.equal(restored.shop_id, otherShopId);
});
test('partial refund cancels earned reward and returns remaining shared stamps to origins', { skip }, async () => {
  const { RefundsService } = await import('../src/refunds.service.js');
  const refunds = new RefundsService(fixture.database as never);
  const data = await checkoutFixture();
  await data.buy(fixture.shopId, 4);
  const order = await data.buy(otherShopId, 6);
  const [item] = await fixture.database.connection`select id from order_items where order_id=${order.orderId}::uuid`;
  const refund = await refunds.create(otherShopId, fixture.otherShopOwnerId, order.orderId, {
    requestId: randomUUID(),
    reason: 'One returned',
    lines: [{ itemId: item.id, qty: 1 }],
  });
  assert.equal(refund.amountSatang, 1000);
  const state = await fixture.database.connection.begin((tx) => resolveSharedLoyalty(tx, fixture.shopId, data.local));
  assert.equal(state?.stampBalance, 9);
  assert.equal(state?.availableRewards.length, 0);
});
test('refund of already expired earnings never debits stamps a second time', { skip }, async () => {
  const { RefundsService } = await import('../src/refunds.service.js');
  const refunds = new RefundsService(fixture.database as never);
  const data = await checkoutFixture();
  const order = await data.buy(fixture.shopId, 3);
  await fixture.database
    .connection`update stamp_ledger set expires_at='2001-01-01T00:00:00Z' where order_id=${order.orderId}::uuid and reason='earn'`;
  const [item] = await fixture.database.connection`select id from order_items where order_id=${order.orderId}::uuid`;
  await refunds.create(fixture.shopId, fixture.ownerId, order.orderId, {
    requestId: randomUUID(),
    reason: 'Returned',
    lines: [{ itemId: item.id, qty: 3 }],
  });
  assert.equal(
    (await fixture.database.connection.begin((tx) => resolveSharedLoyalty(tx, fixture.shopId, data.local)))
      ?.stampBalance,
    0,
  );
});
test('void and full discounted refund never revive expired rewards', { skip }, async () => {
  const { RefundsService } = await import('../src/refunds.service.js');
  const refunds = new RefundsService(fixture.database as never);
  for (const mode of ['void', 'refund']) {
    const data = await checkoutFixture();
    const earned = await data.buy(fixture.shopId, 10);
    const [reward] = await fixture.database
      .connection`select id from rewards where earned_order_id=${earned.orderId}::uuid`;
    const used = await data.buy(otherShopId, 1, reward.id);
    assert.equal(used.totalSatang, 0);
    await fixture.database.connection`update rewards set expires_at='2001-01-01T00:00:00Z' where id=${reward.id}::uuid`;
    if (mode === 'void') {
      await data.orders.voidOrder(otherShopId, used.orderId, fixture.otherShopOwnerId);
    } else {
      const [item] = await fixture.database.connection`select id from order_items where order_id=${used.orderId}::uuid`;
      const result = await refunds.create(otherShopId, fixture.otherShopOwnerId, used.orderId, {
        requestId: randomUUID(),
        reason: 'Free drink returned',
        lines: [{ itemId: item.id, qty: 1 }],
      });
      assert.equal(result.amountSatang, 0);
    }
    const [saved] = await fixture.database.connection`select status from rewards where id=${reward.id}::uuid`;
    assert.equal(saved.status, 'expired');
  }
});
test('member summary includes shared balances and issuer rewards', { skip }, async () => {
  const { MembersService } = await import('../src/members.service.js');
  const members = new MembersService(fixture.database as never);
  const data = await aliases();
  const [reward] = await fixture.database.connection<
    { id: string }[]
  >`insert into rewards(shop_id,member_id,expires_at) values(${otherShopId}::uuid,${data.other}::uuid,'2027-01-01T00:00:00Z') returning id::text as id`;
  const summary = await members.getSummary(fixture.shopId, data.local);
  assert.equal(summary?.stampBalance, 10);
  assert.ok(summary?.availableRewards.some((row) => row.id === reward.id));
  const history = await members.listLedger(fixture.shopId, data.local);
  assert.equal(history.length, 2);
  assert.ok(history.some((row) => row.delta === 6));
});

test('owner management reports selected branches and outstanding issuer liability', { skip }, async () => {
  const settings = await service.get(fixture.shopId, fixture.ownerId);
  assert.equal(settings.group?.name, 'Branches');
  assert.deepEqual(new Set(settings.group?.shops.map((row) => row.id)), new Set([fixture.shopId, otherShopId]));
  const [count] = await fixture.database
    .connection`select count(*)::int as value from rewards where shop_id=${otherShopId}::uuid and status='available' and (expires_at is null or expires_at>clock_timestamp())`;
  assert.equal(settings.group?.shops.find((row) => row.id === otherShopId)?.outstandingRewards, count.value);
  await assert.rejects(service.get(fixture.shopId, fixture.managerId), HttpException);
});
test('available-reward member filter includes a reward issued at another selected branch', { skip }, async () => {
  const { MembersService } = await import('../src/members.service.js');
  const members = new MembersService(fixture.database as never);
  const data = await aliases();
  await fixture.database.connection`update members set display_name=${data.lineId} where id=${data.local}::uuid`;
  await fixture.database
    .connection`insert into rewards(shop_id,member_id,expires_at) values(${otherShopId}::uuid,${data.other}::uuid,'2027-01-01T00:00:00Z')`;
  const result = await members.list(fixture.shopId, { search: data.lineId, availableReward: 'true' });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0]?.id, data.local);
});
test('the same LINE identity outside selected branches cannot contribute or redeem', { skip }, async () => {
  const data = await aliases();
  const sql = fixture.database.connection;
  const [outside] = await sql<
    { id: string }[]
  >`insert into shops(name,slug) values('Excluded',${randomUUID()}) returning id::text as id`;
  try {
    const [member] = await sql<
      { id: string }[]
    >`insert into members(shop_id,display_name,line_user_id) values(${outside.id}::uuid,'Same LINE outside group',${data.lineId}) returning id::text as id`;
    await sql`insert into stamp_ledger(shop_id,member_id,delta,reason) values(${outside.id}::uuid,${member.id}::uuid,100,'earn')`;
    const [reward] = await sql<
      { id: string }[]
    >`insert into rewards(shop_id,member_id) values(${outside.id}::uuid,${member.id}::uuid) returning id::text as id`;
    await sql.begin(async (tx) => {
      const scope = await resolveSharedLoyalty(tx, fixture.shopId, data.local);
      assert.ok(scope);
      assert.equal(scope.stampBalance, 10);
      assert.equal(await redeemSharedReward(tx, scope, reward.id, data.orderId), false);
    });
  } finally {
    await sql`delete from shops where id=${outside.id}::uuid`;
  }
});
test(
  'expired Pro entitlement prevents new groups but preserves existing balances and liabilities',
  { skip },
  async () => {
    const sql = fixture.database.connection;
    await sql`update shop_subscriptions set trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day',paid_until=null where shop_id=${fixture.shopId}::uuid`;
    try {
      await assert.rejects(
        service.create(fixture.shopId, fixture.ownerId, { name: 'New', shopIds: [fixture.shopId, otherShopId] }),
        (error: unknown) =>
          error instanceof HttpException &&
          (error.getResponse() as { code?: string }).code === 'subscription_feature_unavailable',
      );
      assert.equal((await service.get(fixture.shopId, fixture.ownerId)).group?.name, 'Branches');
      const data = await aliases();
      assert.equal((await sql.begin((tx) => resolveSharedLoyalty(tx, fixture.shopId, data.local)))?.stampBalance, 10);
    } finally {
      await sql`update shop_subscriptions set trial_ends_at=now()+interval '1 day' where shop_id=${fixture.shopId}::uuid`;
    }
  },
);
