import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Connection = Sql | TransactionSql;
export interface ShiftRow {
  id: string;
  openedBy: string;
  openedByName: string;
  openingFloatSatang: number;
  openedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  expectedCashSatang: number;
  countedCashSatang: number | null;
  differenceSatang: number | null;
  handedToStaffId: string | null;
}
export interface CashMovementInput { requestId: string; kind: 'float_topup' | 'petty_cash' | 'bank_deposit'; amountSatang: number; reason: string }
export interface CashMovementRow extends CashMovementInput { id: string; shiftId: string; actorStaffId: string; approvedByStaffId: string; createdAt: string }
export interface CashStatementTotals {
  cashSalesSatang: number; cashRefundsSatang: number; topupsSatang: number; pettyCashSatang: number; depositsSatang: number;
}
export interface CashStatementEntry {
  id: string; kind: 'sale' | 'refund' | CashMovementInput['kind']; amountSatang: number; occurredAt: string;
  actorName: string | null; approvedByName: string | null; reason: string; reference: string | null;
  orderId: string | null; dailyNo: number | null; businessDate: string | null;
}
export interface CashStatement {
  shift: ShiftRow; closedByName: string | null; handedToName: string | null; totals: CashStatementTotals;
  ledgerCashSatang: number; snapshotDifferenceSatang: number | null; entries: CashStatementEntry[];
  entryCount: number; page: number; pageSize: number;
}
export interface OpenShiftInput { requestId: string; openingFloatSatang: number }
export interface CloseShiftInput { requestId: string; countedCashSatang: number; handedToStaffId?: string | null }

@Injectable()
export class ShiftsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private validateIds(...ids: string[]) {
    if (ids.some((value) => !UUID.test(value))) { throw new BadRequestException("Invalid identifier"); }
  }

  private validateMoney(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) { throw new BadRequestException("Invalid cash amount"); }
  }

  private async actor(sql: Connection, shopId: string, actorStaffId: string) {
    this.validateIds(shopId, actorStaffId);
    const [actor] = await sql`select role from staff where id=${actorStaffId}::uuid
      and shop_id=${shopId}::uuid and is_active=true for share`;
    if (!actor) { throw new ForbiddenException("Active shop staff required"); }
    return actor;
  }

  private async lockShop(sql: Connection, shopId: string) {
    this.validateIds(shopId);
    const [shop] = await sql`select id from shops where id=${shopId}::uuid for update`;
    if (!shop) { throw new NotFoundException("Shop not found"); }
  }

  private async rows(sql: Connection, shopId: string, shiftId: string | null = null): Promise<ShiftRow[]> {
    const rows = await sql<ShiftRow[]>`select s.id::text, s.opened_by::text as "openedBy", st.name as "openedByName",
      s.opening_float_satang as "openingFloatSatang", s.opened_at::text as "openedAt", s.closed_at::text as "closedAt",
      s.closed_by::text as "closedBy", s.counted_cash_satang as "countedCashSatang", s.handed_to_staff_id::text as "handedToStaffId",
      coalesce(s.expected_cash_satang, s.opening_float_satang + coalesce((select sum(p.amount_satang)
        from payments p join orders o on o.id=p.order_id where o.shift_id=s.id and o.shop_id=s.shop_id and p.method='cash'),0) + coalesce((select sum(case when m.kind='float_topup' then m.amount_satang else -m.amount_satang end)
        from cash_movements m where m.shift_id=s.id and m.shop_id=s.shop_id),0) - coalesce((select sum(r.amount_satang) from refunds r where r.cash_shift_id=s.id and r.shop_id=s.shop_id and r.paid_at is not null and r.payout_method='cash'),0))::float8 as "expectedCashSatang"
      from shifts s join staff st on st.id=s.opened_by
      where s.shop_id=${shopId}::uuid and (${shiftId}::uuid is null or s.id=${shiftId}::uuid)
      order by s.opened_at desc, s.id desc limit 30`;
    return rows.map((row) => {
      if (!Number.isSafeInteger(row.expectedCashSatang)) { throw new ConflictException("Cash total exceeds supported range"); }
      return { ...row, differenceSatang: row.countedCashSatang === null ? null : row.countedCashSatang - row.expectedCashSatang };
    });
  }

  async list(shopId: string, actorStaffId: string) {
    return this.database.connection.begin(async (tx) => {
      await this.actor(tx, shopId, actorStaffId);
      const recipients = await tx<{ id: string; name: string }[]>`select id::text, name from staff
        where shop_id=${shopId}::uuid and is_active=true order by name,id`;
      return { shifts: await this.rows(tx, shopId), recipients };
    });
  }

  async open(shopId: string, actorStaffId: string, input: OpenShiftInput): Promise<ShiftRow> {
    this.validateIds(input.requestId);
    this.validateMoney(input.openingFloatSatang);
    return this.database.connection.begin(async (tx) => {
      await this.lockShop(tx, shopId);
      await this.actor(tx, shopId, actorStaffId);
      const [existing] = await tx`select id::text, opened_by, opening_float_satang from shifts
        where shop_id=${shopId}::uuid and opening_request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.opened_by !== actorStaffId || existing.opening_float_satang !== input.openingFloatSatang) {
          throw new ConflictException("Opening request already used");
        }
        return (await this.rows(tx, shopId, existing.id))[0];
      }
      const [active] = await tx`select id from shifts where shop_id=${shopId}::uuid and closed_at is null`;
      if (active) { throw new ConflictException("A cash shift is already open"); }
      const [shift] = await tx`insert into shifts(shop_id,opened_by,opening_request_id,opening_float_satang)
        values (${shopId}::uuid,${actorStaffId}::uuid,${input.requestId}::uuid,${input.openingFloatSatang}) returning id::text`;
      return (await this.rows(tx, shopId, shift.id))[0];
    });
  }

  async statement(shopId: string, actorStaffId: string, shiftId: string, page = 1): Promise<CashStatement> {
    this.validateIds(shiftId);
    if (!Number.isInteger(page) || page < 1 || page > 10000) { throw new BadRequestException('Invalid statement page'); }
    // All totals and entries must see the same ledger even while the drawer is open.
    return this.database.connection.begin('isolation level repeatable read', async tx => {
      await this.actor(tx, shopId, actorStaffId);
      const [shift] = await this.rows(tx, shopId, shiftId);
      if (!shift) { throw new NotFoundException('Shift not found'); }
      const [people] = await tx<{ closedByName: string | null; handedToName: string | null }[]>`
        select closer.name as "closedByName",recipient.name as "handedToName" from shifts s
        left join staff closer on closer.id=s.closed_by and closer.shop_id=s.shop_id
        left join staff recipient on recipient.id=s.handed_to_staff_id and recipient.shop_id=s.shop_id
        where s.id=${shiftId}::uuid and s.shop_id=${shopId}::uuid`;
      const [data] = await tx<(CashStatementTotals & { entryCount: number; entries: CashStatementEntry[] })[]>`
        with events as (
          select p.id::text as id,'sale'::text as kind,p.amount_satang as "amountSatang",p.created_at as "occurredAt",
            actor.name as "actorName",null::text as "approvedByName",''::text as reason,null::text as reference,
            o.id::text as "orderId",o.daily_no as "dailyNo",o.business_date as "businessDate"
          from payments p join orders o on o.id=p.order_id
          left join staff actor on actor.id=p.confirmed_by and actor.shop_id=o.shop_id
          where o.shop_id=${shopId}::uuid and o.shift_id=${shiftId}::uuid and p.method='cash'
          union all
          select r.id::text,'refund',-r.amount_satang,r.paid_at,actor.name,approver.name,r.reason,r.payout_reference,
            o.id::text,o.daily_no,o.business_date
          from refunds r join orders o on o.id=r.order_id and o.shop_id=r.shop_id
          left join staff actor on actor.id=r.paid_by and actor.shop_id=r.shop_id
          left join staff approver on approver.id=r.approved_by and approver.shop_id=r.shop_id
          where r.shop_id=${shopId}::uuid and r.cash_shift_id=${shiftId}::uuid and r.payout_method='cash' and r.paid_at is not null
          union all
          select m.id::text,m.kind,case when m.kind='float_topup' then m.amount_satang else -m.amount_satang end,m.created_at,
            actor.name,approver.name,m.reason,null::text,null::text,null::int,null::text
          from cash_movements m left join staff actor on actor.id=m.actor_staff_id and actor.shop_id=m.shop_id
          left join staff approver on approver.id=m.approved_by_staff_id and approver.shop_id=m.shop_id
          where m.shop_id=${shopId}::uuid and m.shift_id=${shiftId}::uuid
        ) select
          coalesce(sum("amountSatang") filter(where kind='sale'),0)::float8 as "cashSalesSatang",
          -coalesce(sum("amountSatang") filter(where kind='refund'),0)::float8 as "cashRefundsSatang",
          coalesce(sum("amountSatang") filter(where kind='float_topup'),0)::float8 as "topupsSatang",
          -coalesce(sum("amountSatang") filter(where kind='petty_cash'),0)::float8 as "pettyCashSatang",
          -coalesce(sum("amountSatang") filter(where kind='bank_deposit'),0)::float8 as "depositsSatang",
          count(*)::int as "entryCount",
          (select coalesce(jsonb_agg(to_jsonb(batch) order by batch."occurredAt" desc,batch.id desc,batch.kind),'[]'::jsonb)
            from (select * from events order by "occurredAt" desc,id desc,kind limit 100 offset ${(page - 1) * 100}) batch) as entries
        from events`;
      const { entryCount, entries, ...totals } = data;
      const ledgerCashSatang = shift.openingFloatSatang + totals.cashSalesSatang - totals.cashRefundsSatang
        + totals.topupsSatang - totals.pettyCashSatang - totals.depositsSatang;
      if (![...Object.values(totals), ledgerCashSatang].every(Number.isSafeInteger)) { throw new ConflictException('Cash total exceeds supported range'); }
      return { shift, ...people, totals, ledgerCashSatang,
        snapshotDifferenceSatang: shift.closedAt ? ledgerCashSatang - shift.expectedCashSatang : null,
        entries, entryCount, page, pageSize: 100 };
    });
  }

  async movements(shopId: string, actorStaffId: string, shiftId: string): Promise<CashMovementRow[]> {
    this.validateIds(shiftId);
    return this.database.connection.begin(async (tx) => {
      await this.actor(tx, shopId, actorStaffId);
      return tx<CashMovementRow[]>`select id::text, shift_id::text as "shiftId", request_id::text as "requestId",
        kind, amount_satang as "amountSatang", reason, actor_staff_id::text as "actorStaffId",
        approved_by_staff_id::text as "approvedByStaffId", created_at::text as "createdAt"
        from cash_movements where shop_id=${shopId}::uuid and shift_id=${shiftId}::uuid order by created_at,id`;
    });
  }

  async recordMovement(shopId: string, actorStaffId: string, shiftId: string, input: CashMovementInput): Promise<{ id: string }> {
    this.validateIds(shiftId, input.requestId);
    this.validateMoney(input.amountSatang);
    const reason = input.reason.trim();
    if (!['float_topup','petty_cash','bank_deposit'].includes(input.kind) || input.amountSatang === 0 || !reason || reason.length > 500) {
      throw new BadRequestException('Movement kind, positive amount and reason required');
    }
    return this.database.connection.begin(async (tx) => {
      await this.lockShop(tx, shopId);
      const actor = await this.actor(tx, shopId, actorStaffId);
      if (!['owner','manager'].includes(actor.role)) throw new ForbiddenException('Manager approval required');
      const [existing] = await tx`select * from cash_movements where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.shift_id !== shiftId || existing.actor_staff_id !== actorStaffId || existing.kind !== input.kind
          || existing.amount_satang !== input.amountSatang || existing.reason !== reason) throw new ConflictException('Movement request already used');
        return { id: existing.id };
      }
      const [shift] = await tx`select id,closed_at from shifts where id=${shiftId}::uuid and shop_id=${shopId}::uuid for update`;
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.closed_at) throw new ConflictException('Shift is closed');
      const current = (await this.rows(tx, shopId, shiftId))[0];
      if (input.kind !== 'float_topup' && input.amountSatang > current.expectedCashSatang) throw new ConflictException('Insufficient drawer cash');
      const [movement] = await tx<{ id: string }[]>`insert into cash_movements(shop_id,shift_id,request_id,kind,amount_satang,reason,actor_staff_id,approved_by_staff_id)
        values(${shopId}::uuid,${shiftId}::uuid,${input.requestId}::uuid,${input.kind},${input.amountSatang},${reason},${actorStaffId}::uuid,${actorStaffId}::uuid) returning id::text`;
      return movement;
    });
  }

  async close(shopId: string, actorStaffId: string, shiftId: string, input: CloseShiftInput): Promise<ShiftRow> {
    this.validateIds(shiftId, input.requestId);
    this.validateMoney(input.countedCashSatang);
    const handedTo = input.handedToStaffId ?? null;
    if (handedTo) { this.validateIds(handedTo); }
    return this.database.connection.begin(async (tx) => {
      await this.lockShop(tx, shopId);
      const actor = await this.actor(tx, shopId, actorStaffId);
      const [shift] = await tx`select * from shifts where shop_id=${shopId}::uuid and id=${shiftId}::uuid for update`;
      if (!shift) { throw new NotFoundException("Shift not found"); }
      if (actor.role === "barista" && shift.opened_by !== actorStaffId) { throw new ForbiddenException("Only the opener or a manager may close this shift"); }
      if (shift.closed_at) {
        if (shift.close_request_id !== input.requestId || shift.closed_by !== actorStaffId
          || shift.counted_cash_satang !== input.countedCashSatang || shift.handed_to_staff_id !== handedTo) {
          throw new ConflictException("Closed cash count cannot be changed");
        }
        return (await this.rows(tx, shopId, shiftId))[0];
      }
      const [used] = await tx`select id from shifts where shop_id=${shopId}::uuid and close_request_id=${input.requestId}::uuid`;
      if (used) { throw new ConflictException("Closing request already used"); }
      if (handedTo) { await this.actor(tx, shopId, handedTo); }
      const current = (await this.rows(tx, shopId, shiftId))[0];
      await tx`update shifts set closed_at=clock_timestamp(), closed_by=${actorStaffId}::uuid,
        close_request_id=${input.requestId}::uuid, expected_cash_satang=${current.expectedCashSatang},
        counted_cash_satang=${input.countedCashSatang}, handed_to_staff_id=${handedTo}::uuid where id=${shiftId}::uuid`;
      return (await this.rows(tx, shopId, shiftId))[0];
    });
  }
}
