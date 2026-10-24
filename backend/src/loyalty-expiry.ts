import type { TransactionSql } from "postgres";

export interface LoyaltyExpiryState {
  stampBalance: number;
  remainingLots: { id: string; remaining: number; expiresAt: Date | null; createdAt: Date }[];
  nextStampExpiryAt: Date | null;
  nextRewardExpiryAt: Date | null;
  newExpiresAt: Date;
  asOf: Date;
}
/** Caller must keep this transaction open through any spend or reward mutation. */
export async function applyLoyaltyExpiry(tx: TransactionSql, shopId: string, memberId: string, now?: Date): Promise<LoyaltyExpiryState | null> {
  const [member] = await tx<{ id: string }[]>`
    select id::text as id from members where shop_id = ${shopId}::uuid and id = ${memberId}::uuid
      and deleted_at is null for update
  `;
  if (!member) { return null; }
  // Read the clock after obtaining the lock, including transactions that waited across a deadline.
  const [clock] = await tx<{ asOf: Date; newExpiresAt: Date }[]>`
    select moment as "asOf", ((moment at time zone s.timezone) + make_interval(months => s.stamp_expiry_months))
      at time zone s.timezone as "newExpiresAt"
    from shops s cross join (select coalesce(${now ?? null}::timestamptz, clock_timestamp()) as moment) t
    where s.id = ${shopId}::uuid
  `;
  const entries = await tx<{ id: string; delta: number; expiresAt: Date | null; sourceEntryId: string | null; reason: string; createdAt: Date }[]>`
    select id::text as id, delta, expires_at as "expiresAt", source_entry_id::text as "sourceEntryId", reason, created_at as "createdAt"
    from stamp_ledger where shop_id = ${shopId}::uuid and member_id = ${memberId}::uuid
    -- One checkout expires old lots, earns, then redeems under the same captured timestamp.
    order by created_at, case when reason = 'expire' then 0 when delta > 0 then 1 else 2 end, id
  `;
  const lots: { id: string; remaining: number; expiresAt: Date | null; createdAt: Date }[] = [];
  let debt = 0;
  let balance = 0;
  for (const entry of entries) {
    balance += entry.delta;
    if (entry.delta > 0) {
      const offset = Math.min(debt, entry.delta);
      debt -= offset;
      lots.push({ id: entry.id, remaining: entry.delta - offset, expiresAt: entry.expiresAt, createdAt: entry.createdAt });
    } else if (entry.sourceEntryId) {
      const source = lots.find((lot) => lot.id === entry.sourceEntryId);
      if (source) { source.remaining = Math.max(0, source.remaining + entry.delta); }
    } else {
      let spend = -entry.delta;
      for (const lot of lots) {
        const used = Math.min(lot.remaining, spend);
        lot.remaining -= used;
        spend -= used;
        if (spend === 0) { break; }
      }
      debt += spend;
    }
  }
  let nextStampExpiryAt: Date | null = null;
  for (const lot of lots) {
    if (lot.remaining === 0 || !lot.expiresAt) { continue; }
    if (lot.expiresAt <= clock.asOf) {
      await tx`insert into stamp_ledger (shop_id, member_id, delta, reason, source_entry_id, created_at)
        values (${shopId}::uuid, ${memberId}::uuid, ${-lot.remaining}, 'expire', ${lot.id}::uuid, ${clock.asOf})`;
      balance -= lot.remaining;
      lot.remaining = 0;
    } else if (!nextStampExpiryAt || lot.expiresAt < nextStampExpiryAt) {
      nextStampExpiryAt = lot.expiresAt;
    }
  }
  await tx`update rewards set status = 'expired' where shop_id = ${shopId}::uuid and member_id = ${memberId}::uuid
    and status = 'available' and expires_at <= ${clock.asOf}`;
  const [reward] = await tx<{ expiresAt: Date | null }[]>`select min(expires_at) as "expiresAt" from rewards
    where shop_id = ${shopId}::uuid and member_id = ${memberId}::uuid and status = 'available'`;
  return { remainingLots: lots.filter((lot) => lot.remaining > 0), stampBalance: balance, nextStampExpiryAt, nextRewardExpiryAt: reward.expiresAt, ...clock };
}
