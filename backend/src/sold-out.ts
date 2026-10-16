import type { Sql, TransactionSql } from "postgres";

/**
 * Clears sold-out products marked on an earlier business day when the shop opts in.
 * Runs lazily before menu reads and checkout, so no scheduled job is needed.
 * The date expression matches how orders.business_date is written (shop timezone).
 */
export async function clearExpiredSoldOut(sql: Sql | TransactionSql, shopId: string) {
  await sql`update products p set sold_out = false, sold_out_on = null
    from shops s
    where s.id = ${shopId}::uuid and p.shop_id = s.id and s.auto_clear_sold_out
      and p.sold_out and p.sold_out_on < to_char(now() at time zone s.timezone, 'YYYY-MM-DD')`;
}
