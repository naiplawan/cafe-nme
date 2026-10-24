import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { TransactionSql } from 'postgres';
import { requireShopFeature } from './subscriptions.service.js';
import { applyLoyaltyExpiry } from './loyalty-expiry.js';
import { DatabaseService } from './database.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function ownerIdentity(tx: TransactionSql, shopId: string, actorStaffId: string) {
  const [actor] = await tx<{ userId: string }[]>`select auth_user_id::text as "userId" from staff
    where shop_id = ${shopId}::uuid and id = ${actorStaffId}::uuid and role = 'owner' and is_active and auth_user_id is not null`;
  if (!actor) {
    throw new ForbiddenException('Owner access is required');
  }
  return actor.userId;
}

export interface LoyaltyGroupSettings {
  shops: { id: string; name: string; stampGoal: number; stampExpiryMonths: number; groupId: string | null }[];
  group: { id: string; name: string; shops: { id: string; name: string; outstandingRewards: number }[] } | null;
}

@Injectable()
export class LoyaltyGroupsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async get(shopId: string, actorStaffId: string): Promise<LoyaltyGroupSettings> {
    return this.database.connection.begin(async (tx) => {
      const userId = await ownerIdentity(tx, shopId, actorStaffId);
      const shops = await tx<
        LoyaltyGroupSettings['shops']
      >`select s.id::text as id,s.name,s.stamp_goal as "stampGoal",s.stamp_expiry_months as "stampExpiryMonths",g.group_id::text as "groupId"
        from shops s join staff a on a.shop_id=s.id and a.auth_user_id=${userId}::uuid and a.role='owner' and a.is_active
        left join loyalty_group_shops g on g.shop_id=s.id order by s.name,s.id`;
      const groupId = shops.find((shop) => shop.id === shopId.toLowerCase())?.groupId;
      if (!groupId) {
        return { shops, group: null };
      }
      const [group] = await tx<
        { id: string; name: string }[]
      >`select id::text as id,name from loyalty_groups where id=${groupId}::uuid`;
      const branches = await tx<
        { id: string; name: string; outstandingRewards: number }[]
      >`select s.id::text as id,s.name,
        (select count(*)::int from rewards r where r.shop_id=s.id and r.status='available' and (r.expires_at is null or r.expires_at>clock_timestamp())) as "outstandingRewards"
        from shops s join loyalty_group_shops g on g.shop_id=s.id where g.group_id=${groupId}::uuid order by s.name,s.id`;
      if (branches.some((branch) => !shops.some((shop) => shop.id === branch.id))) {
        throw new ForbiddenException('Owner access to every branch is required');
      }
      return { shops, group: { ...group, shops: branches } };
    });
  }
  async create(shopId: string, actorStaffId: string, input: unknown): Promise<{ id: string }> {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Group input required');
    }
    const value = input as Record<string, unknown>;
    if (
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      value.name.trim().length > 80 ||
      !Array.isArray(value.shopIds) ||
      value.shopIds.length < 2 ||
      value.shopIds.length > 50 ||
      !value.shopIds.every((id) => typeof id === 'string' && UUID.test(id))
    ) {
      throw new BadRequestException('Choose at least two branches and a group name');
    }
    const ids = [...new Set(value.shopIds as string[])].sort((a, b) => a.localeCompare(b));
    if (ids.length !== value.shopIds.length || !ids.includes(shopId)) {
      throw new BadRequestException('Choose distinct branches including this shop');
    }
    const name = value.name.trim();
    return this.database.connection.begin(async (tx) => {
      await tx`select id from shops where id=any(${ids}::uuid[]) order by id for update`;
      for (const id of ids) {
        await tx`select pg_advisory_xact_lock(hashtextextended(${`loyalty-shop:${id}`}, 0))`;
      }
      const userId = await ownerIdentity(tx, shopId, actorStaffId);
      const shops = await tx<
        { id: string; goal: number; months: number }[]
      >`select s.id::text as id, s.stamp_goal as goal, s.stamp_expiry_months as months
        from shops s join staff a on a.shop_id = s.id and a.auth_user_id = ${userId}::uuid and a.role = 'owner' and a.is_active
        where s.id = any(${ids}::uuid[]) order by s.id for update of s, a`;
      if (shops.length !== ids.length) {
        throw new ForbiddenException('You must own every selected branch');
      }
      if (shops.some((shop) => shop.goal !== shops[0].goal || shop.months !== shops[0].months)) {
        throw new ConflictException('Branches must use the same stamp goal and expiry policy');
      }
      for (const id of ids) {
        await requireShopFeature(tx, id, 'shared-loyalty');
      }
      const grouped = await tx`select shop_id from loyalty_group_shops where shop_id = any(${ids}::uuid[])`;
      if (grouped.length) {
        throw new ConflictException('A selected branch already belongs to a loyalty group');
      }
      const [group] = await tx<
        { id: string }[]
      >`insert into loyalty_groups (name, created_by) values (${name}, ${userId}::uuid) returning id::text as id`;
      await tx`insert into loyalty_group_shops (shop_id, group_id) select unnest(${ids}::uuid[]), ${group.id}::uuid`;
      await tx`insert into audit_log (shop_id, actor, action, payload) values (${shopId}::uuid, ${actorStaffId}, 'loyalty.group.create', ${tx.json({ groupId: group.id, shopIds: ids })})`;
      return group;
    });
  }
}

export interface SharedLoyaltyScope {
  groupId: string | null;
  shopId: string;
  memberId: string;
  stampGoal: number;
  stampBalance: number;
  nextStampExpiryAt: Date | null;
  nextRewardExpiryAt: Date | null;
  newExpiresAt: Date;
  asOf: Date;
  aliases: { shopId: string; memberId: string }[];
  availableRewards: { id: string; issuerShopId: string; memberId: string; createdAt: Date; expiresAt: Date | null }[];
  lots: { id: string; shopId: string; memberId: string; remaining: number; expiresAt: Date | null; createdAt: Date }[];
}
export async function resolveSharedLoyalty(
  tx: TransactionSql,
  inputShopId: string,
  inputMemberId: string,
  now?: Date,
): Promise<SharedLoyaltyScope | null> {
  const shopId = inputShopId.toLowerCase();
  const memberId = inputMemberId.toLowerCase();
  await tx`select pg_advisory_xact_lock(hashtextextended(${`loyalty-shop:${shopId}`}, 0))`;
  const [member] = await tx<
    { lineId: string | null; groupId: string | null }[]
  >`select m.line_user_id as "lineId", g.group_id::text as "groupId"
    from members m left join loyalty_group_shops g on g.shop_id=m.shop_id
    where m.shop_id=${shopId}::uuid and m.id=${memberId}::uuid and m.deleted_at is null`;
  if (!member) {
    return null;
  }
  const groupId = member.lineId ? member.groupId : null;
  await tx`select pg_advisory_xact_lock(hashtextextended(${groupId ? `loyalty:${groupId}:${member.lineId}` : `loyalty:${shopId}:${memberId}`}, 0))`;
  if (groupId) {
    const policies = await tx<
      { goal: number; months: number }[]
    >`select s.stamp_goal as goal,s.stamp_expiry_months as months
      from shops s join loyalty_group_shops g on g.shop_id=s.id where g.group_id=${groupId}::uuid`;
    if (policies.some((row) => row.goal !== policies[0].goal || row.months !== policies[0].months)) {
      throw new ConflictException('Shared loyalty policies no longer match');
    }
  }
  const aliases = await tx<
    { shopId: string; memberId: string; stampGoal: number }[]
  >`select m.shop_id::text as "shopId",m.id::text as "memberId",s.stamp_goal as "stampGoal"
    from members m join shops s on s.id=m.shop_id
    where m.deleted_at is null and (
      (${groupId}::uuid is null and m.shop_id=${shopId}::uuid and m.id=${memberId}::uuid)
      or (${groupId}::uuid is not null and m.line_user_id=${member.lineId} and exists(select 1 from loyalty_group_shops g where g.shop_id=m.shop_id and g.group_id=${groupId}::uuid)))
    order by m.id for update of m`;
  if (!aliases.some((alias) => alias.shopId === shopId && alias.memberId === memberId)) {
    return null;
  }
  const [clock] = await tx<{ asOf: Date }[]>`select coalesce(${now ?? null}::timestamptz, clock_timestamp()) as "asOf"`;
  let local: Awaited<ReturnType<typeof applyLoyaltyExpiry>> = null;
  let stampBalance = 0;
  let nextStampExpiryAt: Date | null = null;
  const lots: SharedLoyaltyScope['lots'] = [];
  for (const alias of aliases) {
    const state = await applyLoyaltyExpiry(tx, alias.shopId, alias.memberId, clock.asOf);
    if (!state) {
      continue;
    }
    if (alias.memberId === memberId) {
      local = state;
    }
    stampBalance += state.stampBalance;
    if (state.nextStampExpiryAt && (!nextStampExpiryAt || state.nextStampExpiryAt < nextStampExpiryAt)) {
      nextStampExpiryAt = state.nextStampExpiryAt;
    }
    lots.push(...state.remainingLots.map((lot) => ({ ...lot, shopId: alias.shopId, memberId: alias.memberId })));
  }
  if (!local) {
    return null;
  }
  const memberIds = aliases.map((alias) => alias.memberId);
  const availableRewards = await tx<
    SharedLoyaltyScope['availableRewards']
  >`select id::text as id,shop_id::text as "issuerShopId",member_id::text as "memberId",created_at as "createdAt",expires_at as "expiresAt"
    from rewards where member_id=any(${memberIds}::uuid[]) and status='available' order by created_at,id`;
  const deadlines = availableRewards
    .flatMap((reward) => (reward.expiresAt ? [reward.expiresAt] : []))
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    groupId,
    shopId,
    memberId,
    stampGoal: aliases[0].stampGoal,
    stampBalance,
    nextStampExpiryAt,
    nextRewardExpiryAt: deadlines[0] ?? null,
    newExpiresAt: local.newExpiresAt,
    asOf: clock.asOf,
    aliases,
    availableRewards,
    lots: lots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)),
  };
}

async function requireScopedOrder(tx: TransactionSql, scope: SharedLoyaltyScope, orderId: string) {
  const [order] =
    await tx`select id from orders where id=${orderId}::uuid and shop_id=${scope.shopId}::uuid and member_id=${scope.memberId}::uuid`;
  if (!order) {
    throw new ForbiddenException('Order is outside the current member scope');
  }
}
export async function consumeSharedStamps(
  tx: TransactionSql,
  scope: SharedLoyaltyScope,
  amount: number,
  orderId: string,
  staffId: string,
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > scope.stampBalance) {
    throw new ConflictException('Insufficient shared stamps');
  }
  await requireScopedOrder(tx, scope, orderId);
  let remaining = amount;
  for (const lot of scope.lots) {
    const used = Math.min(remaining, lot.remaining);
    if (!used) {
      continue;
    }
    await tx`insert into stamp_ledger(shop_id,member_id,order_id,delta,reason,staff_id,source_entry_id,created_at)
      values(${lot.shopId}::uuid,${lot.memberId}::uuid,${orderId}::uuid,${-used},'redeem',${staffId}::uuid,${lot.id}::uuid,${scope.asOf})`;
    lot.remaining -= used;
    remaining -= used;
    if (!remaining) {
      break;
    }
  }
  if (remaining) {
    throw new ConflictException('Shared stamp lots are inconsistent');
  }
  scope.stampBalance -= amount;
}
export async function redeemSharedReward(
  tx: TransactionSql,
  scope: SharedLoyaltyScope,
  rewardId: string,
  orderId: string,
): Promise<boolean> {
  await requireScopedOrder(tx, scope, orderId);
  const result =
    await tx`update rewards set status='redeemed',redeemed_order_id=${orderId}::uuid where id=${rewardId}::uuid
    and member_id=any(${scope.aliases.map((alias) => alias.memberId)}::uuid[]) and status='available' and (expires_at is null or expires_at>${scope.asOf}) returning id`;
  return result.length === 1;
}
export async function restoreOrderSharedStamps(
  tx: TransactionSql,
  scope: SharedLoyaltyScope,
  orderId: string,
  staffId: string,
  operationKey: string,
  amount?: number,
): Promise<number> {
  await requireScopedOrder(tx, scope, orderId);
  if (
    !operationKey ||
    operationKey.length > 200 ||
    (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 0))
  ) {
    throw new BadRequestException('Invalid restoration request');
  }
  const prior = await tx<
    {
      payload: {
        operationKey: string;
        orderId: string;
        requestedAmount: number | null;
        restored: number;
        allocations: { sourceDebitId: string; units: number; credited: number }[];
      };
    }[]
  >`
    select payload from audit_log where shop_id=${scope.shopId}::uuid and action='loyalty.restore' and payload->>'orderId'=${orderId}`;
  const replay = prior.find((row) => row.payload.operationKey === operationKey);
  if (replay) {
    if (replay.payload.requestedAmount !== (amount ?? null)) {
      throw new ConflictException('Restoration key reused');
    }
    return replay.payload.restored;
  }
  const consumed = new Map<string, number>();
  for (const row of prior) {
    for (const allocation of row.payload.allocations) {
      consumed.set(allocation.sourceDebitId, (consumed.get(allocation.sourceDebitId) ?? 0) + allocation.units);
    }
  }
  const debits = await tx<
    { id: string; shopId: string; memberId: string; delta: number; expiresAt: Date | null }[]
  >`select d.id::text as id,d.shop_id::text as "shopId",d.member_id::text as "memberId",d.delta,s.expires_at as "expiresAt"
    from stamp_ledger d join stamp_ledger s on s.id=d.source_entry_id and s.shop_id=d.shop_id and s.member_id=d.member_id
    where d.order_id=${orderId}::uuid and d.reason='redeem' and d.delta<0 and d.member_id=any(${scope.aliases.map((alias) => alias.memberId)}::uuid[])
    order by s.created_at,s.id,d.id`;
  let left = amount ?? Number.MAX_SAFE_INTEGER;
  let restored = 0;
  const allocations: { sourceDebitId: string; units: number; credited: number }[] = [];
  for (const debit of debits) {
    const units = Math.min(left, Math.max(0, -debit.delta - (consumed.get(debit.id) ?? 0)));
    if (!units) {
      continue;
    }
    const credited = debit.expiresAt && debit.expiresAt <= scope.asOf ? 0 : units;
    if (credited) {
      await tx`insert into stamp_ledger(shop_id,member_id,order_id,delta,reason,staff_id,source_entry_id,expires_at,created_at)
        values(${debit.shopId}::uuid,${debit.memberId}::uuid,${orderId}::uuid,${credited},'adjust',${staffId}::uuid,${debit.id}::uuid,${debit.expiresAt},${scope.asOf})`;
    }
    allocations.push({ sourceDebitId: debit.id, units, credited });
    restored += credited;
    left -= units;
    if (!left) {
      break;
    }
  }
  await tx`insert into audit_log(shop_id,actor,action,payload) values(${scope.shopId}::uuid,${staffId},'loyalty.restore',${tx.json({ operationKey, orderId, requestedAmount: amount ?? null, allocations, restored })})`;
  return restored;
}

/** Reverse only still-valid original earnings; descendants retain source identity across reward cancellation. */
export async function reverseOrderEarnedStamps(
  tx: TransactionSql,
  scope: SharedLoyaltyScope,
  orderId: string,
  staffId: string,
  amount: number,
  previouslyReversed = 0,
): Promise<number> {
  await requireScopedOrder(tx, scope, orderId);
  const roots = await tx<
    { id: string; delta: number }[]
  >`select id::text as id,delta from stamp_ledger where shop_id=${scope.shopId}::uuid and member_id=${scope.memberId}::uuid
    and order_id=${orderId}::uuid and reason='earn' and delta>0 and (expires_at is null or expires_at>${scope.asOf})`;
  const reversal = Math.min(amount, Math.max(0, roots.reduce((sum, row) => sum + row.delta, 0) - previouslyReversed));
  if (!reversal) {
    return 0;
  }
  const descendants = scope.lots.length
    ? await tx<{ id: string }[]>`with recursive ancestry as (
    select id as lot_id,id,source_entry_id from stamp_ledger where id=any(${scope.lots.map((lot) => lot.id)}::uuid[])
    union all select a.lot_id,l.id,l.source_entry_id from ancestry a join stamp_ledger l on l.id=a.source_entry_id
  ) select distinct lot_id::text as id from ancestry where id=any(${roots.map((row) => row.id)}::uuid[])`
    : [];
  const eligible = new Set(descendants.map((row) => row.id));
  let left = reversal;
  for (const lot of scope.lots) {
    if (!eligible.has(lot.id)) {
      continue;
    }
    const used = Math.min(left, lot.remaining);
    if (!used) {
      continue;
    }
    await tx`insert into stamp_ledger(shop_id,member_id,order_id,delta,reason,staff_id,source_entry_id,created_at)
      values(${lot.shopId}::uuid,${lot.memberId}::uuid,${orderId}::uuid,${-used},'adjust',${staffId}::uuid,${lot.id}::uuid,${scope.asOf})`;
    left -= used;
    lot.remaining -= used;
    if (!left) {
      break;
    }
  }
  // Already spent earnings become debt, offset by future earnings rather than reviving a spent reward.
  if (left) {
    await tx`insert into stamp_ledger(shop_id,member_id,order_id,delta,reason,staff_id,created_at)
    values(${scope.shopId}::uuid,${scope.memberId}::uuid,${orderId}::uuid,${-left},'adjust',${staffId}::uuid,${scope.asOf})`;
  }
  return reversal;
}
