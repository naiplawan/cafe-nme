import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

function asNumber(value: number | string | null): number {
  return Number(value ?? 0);
}

@Injectable()
export class OrderQueriesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getPromptPayId(shopId: string) {
    const [shop] = await this.database.connection<{ promptpayId: string | null }[]>`
      select promptpay_id as "promptpayId" from shops where id = ${shopId}::uuid limit 1
    `;
    return shop ? { promptpayId: shop.promptpayId } : null;
  }

  async getReceiptRecipient(shopId: string, orderId: string) {
    const [recipient] = await this.database.connection<
      {
        dailyNo: number;
        hasMember: boolean;
        lineUserId: string | null;
      }[]
    >`
      select o.daily_no as "dailyNo", (o.member_id is not null) as "hasMember",
        m.line_user_id as "lineUserId"
      from orders o
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid and m.deleted_at is null
      where o.id = ${orderId}::uuid and o.shop_id = ${shopId}::uuid limit 1
    `;
    return recipient ?? null;
  }

  async listOrdersForDay(shopId: string, date: string) {
    const rows = await this.database.connection<
      {
        id: string;
        dailyNo: number;
        status: 'open' | 'paid' | 'void';
        totalSatang: number;
        paymentMethod: 'cash' | 'promptpay' | null;
        memberName: string | null;
        staffName: string | null;
        itemCount: number | string;
        paidAt: Date | null;
      }[]
    >`
      select o.id::text as id, o.daily_no as "dailyNo", o.status, o.total_satang as "totalSatang",
        p.method as "paymentMethod", m.display_name as "memberName", s.name as "staffName",
        coalesce(sum(i.qty), 0) as "itemCount", o.paid_at as "paidAt"
      from orders o
      left join payments p on p.order_id = o.id
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid
      left join staff s on s.id = o.staff_id and s.shop_id = ${shopId}::uuid
      left join order_items i on i.order_id = o.id
      where o.shop_id = ${shopId}::uuid and o.business_date = ${date}
      group by o.id, p.method, m.display_name, s.name
      order by o.created_at desc
    `;
    return rows.map((row) => ({ ...row, totalSatang: Number(row.totalSatang), itemCount: asNumber(row.itemCount) }));
  }

  async getOrder(shopId: string, orderId: string) {
    const [order] = await this.database.connection<
      {
        id: string;
        dailyNo: number;
        status: 'open' | 'paid' | 'void';
        totalSatang: number;
        subtotalSatang: number;
        discountSatang: number;
        paidAt: Date | null;
        voidedAt: Date | null;
        businessDate: string;
        shopName: string;
        receiptFooter: string | null;
        memberName: string | null;
        staffName: string | null;
        paymentMethod: 'cash' | 'promptpay' | null;
        cashReceivedSatang: number | null;
      }[]
    >`
      select o.id::text as id, o.daily_no as "dailyNo", o.status, o.total_satang as "totalSatang",
        o.subtotal_satang as "subtotalSatang", o.discount_satang as "discountSatang", o.paid_at as "paidAt",
        o.voided_at as "voidedAt", o.business_date as "businessDate", sh.name as "shopName",
        sh.receipt_footer as "receiptFooter", m.display_name as "memberName", st.name as "staffName",
        p.method as "paymentMethod", p.cash_received_satang as "cashReceivedSatang"
      from orders o join shops sh on sh.id = o.shop_id
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid
      left join staff st on st.id = o.staff_id and st.shop_id = ${shopId}::uuid
      left join payments p on p.order_id = o.id
      where o.id = ${orderId}::uuid and o.shop_id = ${shopId}::uuid limit 1
    `;
    if (!order) {
      return null;
    }
    const itemRows = await this.database.connection<
      {
        id: string;
        name: string;
        qty: number;
        unitPriceSatang: number;
        note: string | null;
      }[]
    >`
      select id::text as id, name_snapshot as name, qty, unit_price_satang as "unitPriceSatang", note
      from order_items where order_id = ${orderId}::uuid order by line_no
    `;
    const modifiers =
      itemRows.length > 0
        ? await this.database.connection<
            {
              orderItemId: string;
              name: string;
              priceDeltaSatang: number;
            }[]
          >`
      select order_item_id::text as "orderItemId", name_snapshot as name, price_delta_satang as "priceDeltaSatang"
      from order_item_modifiers where order_item_id in ${this.database.connection(itemRows.map((item) => item.id))}
    `
        : [];
    const items = itemRows.map((item) => ({
      ...item,
      modifiers: modifiers
        .filter((modifier) => modifier.orderItemId === item.id)
        .map(({ name, priceDeltaSatang }) => ({ name, priceDeltaSatang: Number(priceDeltaSatang) })),
    }));
    return {
      ...order,
      totalSatang: Number(order.totalSatang),
      subtotalSatang: Number(order.subtotalSatang),
      discountSatang: Number(order.discountSatang),
      cashReceivedSatang: order.cashReceivedSatang === null ? null : Number(order.cashReceivedSatang),
      itemCount: items.reduce((count, item) => count + Number(item.qty), 0),
      items,
    };
  }
}
