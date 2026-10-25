import { consumeOrderStock } from './inventory.service.js';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";

export type PreparationStatus = "received" | "preparing" | "ready";
export interface PreparationRow {
  id: string;
  dailyNo: number;
  status: PreparationStatus;
  updatedAt: string | null;
  items: { id: string; name: string; qty: number; note: string | null; modifiers: string[] }[];
}
export interface PreparationUpdate { id: string; status: PreparationStatus; updatedAt: string | null }

@Injectable()
export class PreparationService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private async requireStaff(sql: Sql | TransactionSql, shopId: string, actor: string) {
    const [staff] = await sql`select id from staff where id=${actor}::uuid and shop_id=${shopId}::uuid
      and is_active=true and role in ('owner','manager','barista') for share`;
    if (!staff) { throw new ForbiddenException("Active shop staff required"); }
  }

  async list(shopId: string, actor: string): Promise<PreparationRow[]> {
    return this.database.connection.begin(async (tx) => {
      await this.requireStaff(tx, shopId, actor);
      return tx<PreparationRow[]>`select o.id::text as id, o.daily_no as "dailyNo", o.prep_status as status,
        o.prep_updated_at::text as "updatedAt", coalesce(items.rows,'[]'::jsonb) as items
        from orders o join shops sh on sh.id=o.shop_id
        left join lateral (
          select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name_snapshot,'qty',i.qty-coalesce(refunded.qty,0),'note',i.note,
            'modifiers',coalesce((select jsonb_agg(m.name_snapshot order by m.id)
              from order_item_modifiers m where m.order_item_id=i.id),'[]'::jsonb)) order by i.line_no,i.id) as rows
          from order_items i left join lateral (select sum((line->>'qty')::int)::int as qty from refunds r
            cross join lateral jsonb_array_elements(r.lines) line where r.order_id=i.order_id and r.shop_id=o.shop_id
            and line->>'itemId'=i.id::text) refunded on true where i.order_id=o.id and i.qty>coalesce(refunded.qty,0)
        ) items on true
        where o.shop_id=${shopId}::uuid and o.status='paid'
          and (o.business_date=to_char(now() at time zone sh.timezone,'YYYY-MM-DD') or (o.stock_consumption='preparation' and o.prep_status in ('received','preparing')))
          and items.rows is not null
        order by o.business_date,o.daily_no`;
    });
  }

  async transition(shopId: string, actor: string, orderId: string, expected: PreparationStatus, desired: PreparationStatus): Promise<PreparationUpdate> {
    return this.database.connection.begin(async (tx) => {
      await tx`select id from shops where id=${shopId}::uuid for share`;
      await this.requireStaff(tx, shopId, actor);
      if (!((expected === "received" && desired === "preparing") || (expected === "preparing" && desired === "ready"))) {
        throw new BadRequestException("Invalid preparation transition");
      }
      // Share the order lock used by voiding; a voided bill cannot advance.
      const [order] = await tx<PreparationUpdate[]>`select o.id::text as id, o.prep_status as status,
        o.prep_updated_at::text as "updatedAt" from orders o join shops sh on sh.id=o.shop_id
        where o.id=${orderId}::uuid and o.shop_id=${shopId}::uuid and o.status='paid'
          and (o.business_date=to_char(now() at time zone sh.timezone,'YYYY-MM-DD') or o.recipe_snapshot_at is not null) for update of o`;
      if (!order) { throw new NotFoundException("Current paid order not found"); }
      if (order.status === desired) { return order; }
      if (order.status !== expected) { throw new ConflictException("Preparation status changed; refresh queue"); }
      const [remaining] = await tx`select coalesce(sum(i.qty),0) - coalesce((select sum((line->>'qty')::int) from refunds r
        cross join lateral jsonb_array_elements(r.lines) line where r.shop_id=${shopId}::uuid and r.order_id=${orderId}::uuid),0) as qty
        from order_items i where i.order_id=${orderId}::uuid`;
      if (Number(remaining.qty) <= 0) throw new ConflictException('Fully refunded orders cannot be prepared');
      if (desired === 'preparing') await consumeOrderStock(tx, shopId, orderId, actor);
      const [updated] = await tx<PreparationUpdate[]>`update orders set prep_status=${desired},prep_updated_at=clock_timestamp()
        where id=${orderId}::uuid and shop_id=${shopId}::uuid and prep_status=${expected}
        returning id::text as id,prep_status as status,prep_updated_at::text as "updatedAt"`;
      return updated;
    });
  }
}
