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
        from payments p join orders o on o.id=p.order_id where o.shift_id=s.id and o.shop_id=s.shop_id and p.method='cash'),0) - coalesce((select sum(r.amount_satang) from refunds r where r.cash_shift_id=s.id and r.shop_id=s.shop_id and r.paid_at is not null and r.payout_method='cash'),0))::float8 as "expectedCashSatang"
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
