import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Connection = Sql | TransactionSql;
export type SubscriptionPlan = "basic" | "pro";
export type ShopFeature = "core-pos" | "reports" | "shifts" | "refunds" | "public-menu" | "self-order" | "inventory-write" | "shared-loyalty";
const BASIC_FEATURES: ShopFeature[] = ["core-pos", "reports", "shifts", "refunds", "public-menu"];
const PRO_FEATURES: ShopFeature[] = ["self-order", "inventory-write", "shared-loyalty"];
interface SubscriptionRow {
  plan: SubscriptionPlan;
  trialStartedAt: Date;
  trialEndsAt: Date;
  paidUntil: Date | null;
  now: Date;
}
export interface SubscriptionPayment {
  id: string;
  plan: SubscriptionPlan;
  paidAmountSatang: number;
  periodDays: number;
  periodStartsAt: string;
  periodEndsAt: string;
  externalReceiptRef: string;
  recordedByStaffId: string;
  recordedByUserId: string;
  createdAt: string;
}
export interface SubscriptionState {
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  status: "trial" | "active" | "expired";
  trialStartedAt: string;
  trialEndsAt: string;
  paidUntil: string | null;
  canRecordPayment: boolean;
  allowedFeatures: ShopFeature[];
  payments: SubscriptionPayment[];
}
export interface RenewalInput {
  requestId: string;
  plan: SubscriptionPlan;
  paidAmountSatang: number;
  periodDays: number;
  externalReceiptRef: string;
}
function validateIds(...values: string[]) {
  if (values.some((value) => !UUID.test(value))) { throw new BadRequestException("Invalid identifier"); }
}
function isOperator(userId: string) {
  return (process.env.BILLING_OPERATOR_USER_IDS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter((value) => UUID.test(value)).includes(userId.toLowerCase());
}
async function actor(sql: Connection, shopId: string, actorStaffId: string, actorUserId: string) {
  validateIds(shopId, actorStaffId, actorUserId);
  const [staff] = await sql`select s.id from staff s join users u on u.id=s.auth_user_id
    where s.id=${actorStaffId}::uuid and s.shop_id=${shopId}::uuid and s.auth_user_id=${actorUserId}::uuid and s.is_active=true for share of s,u`;
  if (!staff) { throw new ForbiddenException("Authenticated shop membership required"); }
}
async function ensureSubscription(sql: Connection, shopId: string) {
  validateIds(shopId);
  await sql`with locked_shop as materialized (select id from shops where id=${shopId}::uuid for key share)
    insert into shop_subscriptions(shop_id,plan,trial_started_at,trial_ends_at)
    select id,'basic',now(),now()+interval '336 hours' from locked_shop
    on conflict (shop_id) do nothing`;
}
async function readSubscription(sql: Connection, shopId: string, lock: "share" | "update"): Promise<SubscriptionRow> {
  const rows = lock === "update"
    ? await sql<SubscriptionRow[]>`select plan,trial_started_at as "trialStartedAt",trial_ends_at as "trialEndsAt",paid_until as "paidUntil",clock_timestamp() as now
        from shop_subscriptions where shop_id=${shopId}::uuid for update`
    : await sql<SubscriptionRow[]>`select plan,trial_started_at as "trialStartedAt",trial_ends_at as "trialEndsAt",paid_until as "paidUntil",clock_timestamp() as now
        from shop_subscriptions where shop_id=${shopId}::uuid for share`;
  if (!rows[0]) { throw new NotFoundException("Shop subscription not found"); }
  return rows[0];
}
function entitlement(row: SubscriptionRow) {
  const status = row.trialEndsAt > row.now ? "trial" as const : row.paidUntil && row.paidUntil > row.now ? "active" as const : "expired" as const;
  const effectivePlan = status === "trial" ? "pro" as const : status === "active" ? row.plan : "basic" as const;
  return { status, effectivePlan, allowedFeatures: effectivePlan === "pro" ? [...BASIC_FEATURES, ...PRO_FEATURES] : [...BASIC_FEATURES] };
}

/** Use inside the protected write transaction so renewal/downgrade cannot race the mutation. */
export async function requireShopFeature(sql: Connection, shopId: string, feature: ShopFeature): Promise<void> {
  if (![...BASIC_FEATURES, ...PRO_FEATURES].includes(feature)) { throw new BadRequestException("Unknown shop feature"); }
  await ensureSubscription(sql, shopId);
  const row = await readSubscription(sql, shopId, "share");
  if (!entitlement(row).allowedFeatures.includes(feature)) {
    throw new ForbiddenException({ code: "subscription_feature_unavailable", message: "This feature requires an active Pro plan or trial" });
  }
}

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private async payments(sql: Connection, shopId: string): Promise<SubscriptionPayment[]> {
    const rows = await sql<(Omit<SubscriptionPayment, "createdAt" | "periodStartsAt" | "periodEndsAt"> & { createdAt: Date; periodStartsAt: Date; periodEndsAt: Date })[]>`
      select id::text,plan,paid_amount_satang as "paidAmountSatang",period_days as "periodDays",period_starts_at as "periodStartsAt",period_ends_at as "periodEndsAt",
        external_receipt_ref as "externalReceiptRef",recorded_by_staff_id::text as "recordedByStaffId",recorded_by_user_id::text as "recordedByUserId",created_at as "createdAt"
      from subscription_payments where shop_id=${shopId}::uuid order by created_at desc,id desc`;
    return rows.map((row) => ({ ...row, periodStartsAt: row.periodStartsAt.toISOString(), periodEndsAt: row.periodEndsAt.toISOString(), createdAt: row.createdAt.toISOString() }));
  }

  async get(shopId: string, actorStaffId: string, actorUserId: string): Promise<SubscriptionState> {
    return this.database.connection.begin(async (tx) => {
      await actor(tx, shopId, actorStaffId, actorUserId);
      await ensureSubscription(tx, shopId);
      const row = await readSubscription(tx, shopId, "share");
      return { plan: row.plan, ...entitlement(row), trialStartedAt: row.trialStartedAt.toISOString(), trialEndsAt: row.trialEndsAt.toISOString(),
        paidUntil: row.paidUntil?.toISOString() ?? null, canRecordPayment: isOperator(actorUserId), payments: await this.payments(tx, shopId) };
    });
  }

  async renew(shopId: string, actorStaffId: string, actorUserId: string, input: RenewalInput): Promise<{ id: string }> {
    validateIds(input.requestId);
    if (!["basic", "pro"].includes(input.plan) || !Number.isSafeInteger(input.paidAmountSatang) || input.paidAmountSatang < 1 || input.paidAmountSatang > 2147483647
      || !Number.isSafeInteger(input.periodDays) || input.periodDays < 1 || input.periodDays > 366 || typeof input.externalReceiptRef !== "string"
      || !input.externalReceiptRef.trim() || input.externalReceiptRef.trim().length > 200) { throw new BadRequestException("Invalid manual renewal"); }
    const reference = input.externalReceiptRef.trim();
    return this.database.connection.begin(async (tx) => {
      await actor(tx, shopId, actorStaffId, actorUserId);
      if (!isOperator(actorUserId)) { throw new ForbiddenException("Only an authorized platform billing operator can record payment"); }
      await ensureSubscription(tx, shopId);
      const subscription = await readSubscription(tx, shopId, "update");
      // A receipt cannot be applied to multiple shops; lock before checking the global reference.
      await tx`select pg_advisory_xact_lock(hashtextextended(${`billing-receipt:${reference}`},0))`;
      const existing = await tx`select id::text,shop_id,request_id,plan,paid_amount_satang,period_days,external_receipt_ref,recorded_by_user_id,recorded_by_staff_id
        from subscription_payments where (shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid) or external_receipt_ref=${reference}`;
      if (existing.length) {
        const payment = existing[0];
        if (existing.length !== 1 || payment.shop_id !== shopId || payment.plan !== input.plan || payment.paid_amount_satang !== input.paidAmountSatang
          || payment.period_days !== input.periodDays || payment.external_receipt_ref !== reference
          || payment.recorded_by_user_id !== actorUserId || payment.recorded_by_staff_id !== actorStaffId) { throw new ConflictException("Renewal request or receipt already used"); }
        return { id: payment.id as string };
      }
      const start = new Date(Math.max(subscription.now.getTime(), subscription.trialEndsAt.getTime(), subscription.paidUntil?.getTime() ?? 0));
      const end = new Date(start.getTime() + input.periodDays * 86400000);
      const [payment] = await tx<{ id: string }[]>`insert into subscription_payments(shop_id,request_id,plan,paid_amount_satang,period_days,period_starts_at,period_ends_at,
        external_receipt_ref,recorded_by_staff_id,recorded_by_user_id)
        values (${shopId}::uuid,${input.requestId}::uuid,${input.plan},${input.paidAmountSatang},${input.periodDays},${start},${end},${reference},${actorStaffId}::uuid,${actorUserId}::uuid)
        returning id::text`;
      await tx`update shop_subscriptions set plan=${input.plan},paid_until=${end} where shop_id=${shopId}::uuid`;
      return payment;
    });
  }
}
