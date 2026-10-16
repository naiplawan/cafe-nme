import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

export interface DateRange { from: string; to: string }
export interface SalesSummary {
  orders: number;
  voided: number;
  grossSatang: number;
  discountSatang: number;
  netSatang: number;
  cups: number;
  byMethod: { cash: number; promptpay: number };
  memberOrders: number;
  stampsIssued: number;
  rewardsRedeemed: number;
  newMembers: number;
}

const asNumber = (value: number | string) => Number(value);

@Injectable()
export class ReportsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async salesSummary(shopId: string, { from, to }: DateRange): Promise<SalesSummary> {
    const [row] = await this.database.connection<{
      orders: number | string;
      voided: number | string;
      gross_satang: number | string;
      discount_satang: number | string;
      net_satang: number | string;
      cups: number | string;
      cash: number | string;
      promptpay: number | string;
      member_orders: number | string;
      stamps_issued: number | string;
      rewards_redeemed: number | string;
      new_members: number | string;
    }[]>`
      SELECT
        (SELECT count(*) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid') AS orders,
        (SELECT count(*) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'void') AS voided,
        (SELECT coalesce(sum(o.subtotal_satang), 0) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid') AS gross_satang,
        (SELECT coalesce(sum(o.discount_satang), 0) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid') AS discount_satang,
        (SELECT coalesce(sum(o.total_satang), 0) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid') AS net_satang,
        (SELECT coalesce(sum(i.qty), 0) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid') AS cups,
        (SELECT coalesce(sum(p.amount_satang), 0) FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid' AND p.method = 'cash') AS cash,
        (SELECT coalesce(sum(p.amount_satang), 0) FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid' AND p.method = 'promptpay') AS promptpay,
        (SELECT count(*) FROM orders o WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid' AND o.member_id IS NOT NULL) AS member_orders,
        (SELECT coalesce(sum(l.delta), 0) FROM stamp_ledger l JOIN orders o ON o.id = l.order_id WHERE l.shop_id = ${shopId}::uuid AND o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND l.reason = 'earn' AND l.delta > 0) AS stamps_issued,
        (SELECT count(*) FROM rewards r JOIN orders o ON o.id = r.redeemed_order_id WHERE r.shop_id = ${shopId}::uuid AND o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND r.status = 'redeemed') AS rewards_redeemed,
        (SELECT count(*) FROM members m WHERE m.shop_id = ${shopId}::uuid AND m.deleted_at IS NULL AND m.created_at >= (${from}::date::timestamp AT TIME ZONE 'Asia/Bangkok') AND m.created_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')) AS new_members
    `;
    return {
      orders: asNumber(row.orders),
      voided: asNumber(row.voided),
      grossSatang: asNumber(row.gross_satang),
      discountSatang: asNumber(row.discount_satang),
      netSatang: asNumber(row.net_satang),
      cups: asNumber(row.cups),
      byMethod: { cash: asNumber(row.cash), promptpay: asNumber(row.promptpay) },
      memberOrders: asNumber(row.member_orders),
      stampsIssued: asNumber(row.stamps_issued),
      rewardsRedeemed: asNumber(row.rewards_redeemed),
      newMembers: asNumber(row.new_members),
    };
  }

  async salesByItem(shopId: string, { from, to }: DateRange) {
    const rows = await this.database.connection<{ name: string; qty: number | string; revenue_satang: number | string }[]>`
      SELECT i.name_snapshot AS name, sum(i.qty) AS qty,
        sum(i.unit_price_satang * i.qty) AS revenue_satang
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid'
      GROUP BY i.name_snapshot ORDER BY sum(i.qty) DESC, i.name_snapshot ASC
    `;
    return rows.map((row) => ({ name: row.name, qty: asNumber(row.qty), revenueSatang: asNumber(row.revenue_satang) }));
  }

  async dailySales(shopId: string, { from, to }: DateRange) {
    const rows = await this.database.connection<{ date: string; orders: number | string; net_satang: number | string }[]>`
      SELECT o.business_date::text AS date, count(*) AS orders, sum(o.total_satang) AS net_satang
      FROM orders o
      WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid'
      GROUP BY o.business_date ORDER BY o.business_date
    `;
    return rows.map((row) => ({ date: row.date, orders: asNumber(row.orders), netSatang: asNumber(row.net_satang) }));
  }

  async hourlySales(shopId: string, { from, to }: DateRange) {
    const rows = await this.database.connection<{ hour: number | string; orders: number | string; net_satang: number | string }[]>`
      SELECT extract(hour FROM o.paid_at AT TIME ZONE 'Asia/Bangkok') AS hour,
        count(*) AS orders, sum(o.total_satang) AS net_satang
      FROM orders o
      WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text
        AND o.status = 'paid' AND o.paid_at IS NOT NULL
      GROUP BY extract(hour FROM o.paid_at AT TIME ZONE 'Asia/Bangkok')
    `;
    const totals = new Map(rows.map((row) => [asNumber(row.hour), {
      orders: asNumber(row.orders),
      netSatang: asNumber(row.net_satang),
    }]));
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: totals.get(hour)?.orders ?? 0,
      netSatang: totals.get(hour)?.netSatang ?? 0,
    }));
  }

  async categorySales(shopId: string, { from, to }: DateRange) {
    const rows = await this.database.connection<{ category: string; qty: number | string; revenue_satang: number | string }[]>`
      SELECT coalesce(c.name, 'อื่นๆ') AS category,
        sum(i.qty) AS qty, sum(i.unit_price_satang * i.qty) AS revenue_satang
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      LEFT JOIN products p ON p.id = i.product_id AND p.shop_id = o.shop_id
      LEFT JOIN categories c ON c.id = p.category_id AND c.shop_id = o.shop_id
      WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid'
      GROUP BY coalesce(c.name, 'อื่นๆ')
      ORDER BY sum(i.unit_price_satang * i.qty) DESC, coalesce(c.name, 'อื่นๆ') ASC
    `;
    return rows.map((row) => ({ category: row.category, qty: asNumber(row.qty), revenueSatang: asNumber(row.revenue_satang) }));
  }

  async memberGrowth(shopId: string, { from, to }: DateRange) {
    const rows = await this.database.connection<{
      date: string;
      new_members: number | string;
      total_members: number | string;
    }[]>`
      WITH days AS (
        SELECT day::date AS day
        FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS day
      )
      SELECT days.day::text AS date,
        count(m.id) FILTER (
          WHERE (m.created_at AT TIME ZONE 'Asia/Bangkok')::date = days.day
        ) AS new_members,
        count(m.id) AS total_members
      FROM days
      LEFT JOIN members m ON m.shop_id = ${shopId}::uuid AND m.deleted_at IS NULL
        AND (m.created_at AT TIME ZONE 'Asia/Bangkok')::date <= days.day
      GROUP BY days.day
      ORDER BY days.day
    `;
    return rows.map((row) => ({
      date: row.date,
      newMembers: asNumber(row.new_members),
      totalMembers: asNumber(row.total_members),
    }));
  }

  async memberOverview(shopId: string) {
    const [row] = await this.database.connection<{
      total: number | string;
      line_linked: number | string;
      active30d: number | string;
      rewards_available: number | string;
    }[]>`
      SELECT
        (SELECT count(*) FROM members m WHERE m.shop_id = ${shopId}::uuid AND m.deleted_at IS NULL) AS total,
        (SELECT count(*) FROM members m WHERE m.shop_id = ${shopId}::uuid AND m.deleted_at IS NULL AND m.line_user_id IS NOT NULL) AS line_linked,
        (SELECT count(*) FROM members m WHERE m.shop_id = ${shopId}::uuid AND m.deleted_at IS NULL AND EXISTS (
          SELECT 1 FROM orders o WHERE o.shop_id = m.shop_id AND o.member_id = m.id AND o.status = 'paid'
            AND o.paid_at >= now() - interval '30 days'
        )) AS "active30d",
        (SELECT count(*) FROM rewards r JOIN members m ON m.id = r.member_id AND m.shop_id = r.shop_id
          WHERE r.shop_id = ${shopId}::uuid AND r.status = 'available' AND m.deleted_at IS NULL) AS rewards_available
    `;
    return {
      total: asNumber(row.total),
      lineLinked: asNumber(row.line_linked),
      active30d: asNumber(row.active30d),
      rewardsAvailable: asNumber(row.rewards_available),
    };
  }

  async ordersForExport(shopId: string, { from, to }: DateRange): Promise<Record<string, string | number>[]> {
    const rows = await this.database.connection<{
      date: string;
      daily_no: number;
      member: string;
      method: string;
      subtotal_satang: number | string;
      discount_satang: number | string;
      total_satang: number | string;
      cups: number | string;
    }[]>`
      SELECT o.business_date::text AS date, o.daily_no,
        coalesce(m.display_name, '') AS member, coalesce(p.method::text, '') AS method,
        o.subtotal_satang, o.discount_satang, o.total_satang,
        coalesce((SELECT sum(i.qty) FROM order_items i WHERE i.order_id = o.id), 0) AS cups
      FROM orders o
      LEFT JOIN members m ON m.id = o.member_id AND m.shop_id = o.shop_id
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.shop_id = ${shopId}::uuid AND o.business_date BETWEEN ${from}::text AND ${to}::text AND o.status = 'paid'
      ORDER BY o.business_date, o.daily_no
    `;
    return rows.map((row) => ({
      date: row.date,
      orderNo: row.daily_no,
      member: row.member,
      paymentMethod: row.method,
      grossSatang: asNumber(row.subtotal_satang),
      discountSatang: asNumber(row.discount_satang),
      netSatang: asNumber(row.total_satang),
      cups: asNumber(row.cups),
    }));
  }
}
