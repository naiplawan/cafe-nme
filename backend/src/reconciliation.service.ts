import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export interface PaymentReviewInput {
  requestId: string;
  observedSatang: number;
  note: string;
}
export interface ReconciliationRow {
  paymentId: string;
  dailyNo: number;
  method: "cash" | "promptpay";
  expectedSatang: number;
  observedSatang: number | null;
  differenceSatang: number | null;
  status: "pending" | "matched" | "discrepancy";
  recordedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  source: "staff" | "provider" | null;
  note: string | null;
}

@Injectable()
export class ReconciliationService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private async requireManager(sql: Sql | TransactionSql, shopId: string, actorStaffId: string) {
    if (!UUID.test(shopId) || !UUID.test(actorStaffId)) {
      throw new BadRequestException("Invalid shop or staff ID");
    }
    const [actor] = await sql`select id from staff where id=${actorStaffId}::uuid
      and shop_id=${shopId}::uuid and is_active=true and role in ('owner','manager') for share`;
    if (!actor) { throw new ForbiddenException("Only active shop managers may review receipts"); }
  }

  async list(shopId: string, actorStaffId: string, day: string): Promise<ReconciliationRow[]> {
    await this.requireManager(this.database.connection, shopId, actorStaffId);
    if (!DAY.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) {
      throw new BadRequestException("Invalid business date");
    }
    return this.database.connection<ReconciliationRow[]>`
      select p.id::text as "paymentId", o.daily_no as "dailyNo", p.method,
        p.amount_satang as "expectedSatang", coalesce(provider.amount_satang,r.observed_satang) as "observedSatang",
        coalesce(provider.amount_satang,r.observed_satang) - p.amount_satang as "differenceSatang",
        case when provider.id is not null then 'matched' when r.id is null then 'pending'
          when r.observed_satang=p.amount_satang then 'matched' else 'discrepancy' end as status,
        coalesce(case when provider.id is not null then 'Omise' end,cashier.name) as "recordedBy", reviewer.name as "reviewedBy", r.created_at::text as "reviewedAt",
        case when provider.id is not null then 'provider' when r.id is not null then 'staff' else null end as source,
        case when provider.id is not null then 'ผู้ให้บริการยืนยันยอดและสถานะชำระแล้ว' else r.note end as note
      from payments p join orders o on o.id=p.order_id
      left join staff cashier on cashier.id=p.confirmed_by and cashier.shop_id=o.shop_id
      left join provider_payment_intents provider on provider.order_id=o.id and provider.shop_id=o.shop_id
        and provider.status='completed' and provider.verified_at is not null
      left join lateral (select * from payment_reviews pr where pr.payment_id=p.id and pr.shop_id=o.shop_id
        order by pr.created_at desc, pr.id desc limit 1) r on true
      left join staff reviewer on reviewer.id=r.reviewed_by and reviewer.shop_id=o.shop_id
      where o.shop_id=${shopId}::uuid and o.business_date=${day} and o.status='paid'
      order by o.daily_no, p.id`;
  }

  async review(shopId: string, actorStaffId: string, paymentId: string, input: PaymentReviewInput): Promise<{ id: string }> {
    if (!UUID.test(paymentId) || !UUID.test(input.requestId) || !Number.isSafeInteger(input.observedSatang)
      || input.observedSatang < 0 || input.observedSatang > 2147483647 || typeof input.note !== "string" || input.note.length > 500) {
      throw new BadRequestException("Invalid receipt review");
    }
    const note = input.note.trim();
    return this.database.connection.begin(async (tx) => {
      await this.requireManager(tx, shopId, actorStaffId);
      // Lock order as well as payment so void and review cannot race.
      const [payment] = await tx`select p.amount_satang, o.status from payments p join orders o on o.id=p.order_id
        where p.id=${paymentId}::uuid and o.shop_id=${shopId}::uuid for update of o,p`;
      if (!payment) { throw new NotFoundException("Payment not found"); }
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:review:${input.requestId}`},0))`;
      const [existing] = await tx`select id::text, payment_id, reviewed_by, observed_satang, note
        from payment_reviews where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.payment_id !== paymentId || existing.reviewed_by !== actorStaffId
          || existing.observed_satang !== input.observedSatang || existing.note !== note) {
          throw new ConflictException("Review request ID already used");
        }
        return { id: existing.id as string };
      }
      if (payment.status !== "paid") { throw new ConflictException("Only paid bills can be reviewed"); }
      if (payment.amount_satang !== input.observedSatang && !note) {
        throw new BadRequestException("A discrepancy requires a reason");
      }
      const [review] = await tx<{ id: string }[]>`insert into payment_reviews
        (shop_id,payment_id,request_id,observed_satang,reviewed_by,note,created_at)
        values (${shopId}::uuid,${paymentId}::uuid,${input.requestId}::uuid,${input.observedSatang},${actorStaffId}::uuid,${note},clock_timestamp())
        returning id::text`;
      return { id: review.id };
    });
  }
}
