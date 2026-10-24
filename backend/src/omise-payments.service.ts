import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";
import { OrdersService, type CheckoutInput } from "./orders.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHARGE = /^chrg(?:_test)?_[a-z0-9]+$/;
const EVENT = /^evnt(?:_test)?_[a-z0-9]+$/;
type Connection = Sql | TransactionSql;
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
export type ProviderPaymentStatus = "not_started" | "creating" | "uncertain" | "pending" | "verified" | "paid_unfulfilled" | "discrepancy" | "completed" | "failed" | "expired";
export interface ProviderPaymentView {
  id: string | null;
  configured: boolean;
  testMode: boolean | null;
  status: ProviderPaymentStatus;
  amountSatang: number | null;
  qrImageUrl: string | null;
  orderId: string | null;
  dailyNo: number | null;
  discrepancyCode: string | null;
}
interface Intent {
  id: string; shop_id: string; self_order_id: string; staff_id: string; amount_satang: number; currency: string; test_mode: boolean;
  checkout_input: CheckoutInput; provider_account_id: string | null; provider_charge_id: string | null; status: ProviderPaymentStatus;
  created_at: Date; verified_at: Date | null; order_id: string | null;
}
interface Merchant { secret: string; testMode: boolean }
class ProviderFailure extends Error { constructor(readonly status: number) { super("Provider request unavailable"); } }
function merchant(shopId: string): Merchant | null {
  try {
    const secret = object(JSON.parse(process.env.OMISE_SHOP_SECRET_KEYS ?? "{}"))[shopId];
    if (typeof secret !== "string" || !/^skey_(test|live)_[a-z0-9]+$/i.test(secret)) { return null; }
    const testMode = secret.startsWith("skey_test_");
    if (!testMode && process.env.OMISE_LIVE_ENABLED !== "true") { return null; }
    return { secret, testMode };
  } catch { return null; }
}
async function provider(config: Merchant, path: string, body?: URLSearchParams): Promise<Json> {
  const response = await fetch(`https://api.omise.co${path}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { authorization: `Basic ${Buffer.from(`${config.secret}:`).toString("base64")}`, "Omise-Version": "2019-05-29",
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    ...(body ? { body: body.toString() } : {}),
  });
  if (!response.ok) { await response.body?.cancel(); throw new ProviderFailure(response.status); }
  return object(await response.json());
}
async function account(config: Merchant): Promise<string> {
  const value = await provider(config, "/account");
  if (value.object !== "account" || typeof value.id !== "string" || !/^account(?:_test)?_[a-z0-9]+$/.test(value.id) || value.livemode !== !config.testMode) {
    throw new ProviderFailure(502);
  }
  return value.id;
}
async function requireStaff(sql: Connection, shopId: string, staffId: string) {
  if (!UUID.test(shopId) || !UUID.test(staffId)) { throw new BadRequestException("Invalid identifier"); }
  const [staff] = await sql`select id from staff where shop_id=${shopId}::uuid and id=${staffId}::uuid and is_active=true for share`;
  if (!staff) { throw new ForbiddenException("Active shop staff required"); }
}
function qrUrl(charge: Json): string | null {
  const value = object(object(object(charge.source).scannable_code).image).download_uri;
  if (typeof value !== "string") { return null; }
  try {
    const url = new URL(value);
    return url.origin === "https://api.omise.co" && !url.username && !url.password
      && url.pathname.startsWith(`/charges/${charge.id}/documents/`) && url.pathname.includes("/downloads/") ? url.href : null;
  } catch { return null; }
}

@Injectable()
export class OmisePaymentsService {
  private readonly logger = new Logger(OmisePaymentsService.name);
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(OrdersService) private readonly orders: OrdersService) {}

  private async view(sql: Connection, shopId: string, draftId: string): Promise<ProviderPaymentView> {
    const config = merchant(shopId);
    const [row] = await sql<Omit<ProviderPaymentView, "configured">[]>`select p.id::text,p.test_mode as "testMode",p.status,p.amount_satang as "amountSatang",
      p.qr_image_url as "qrImageUrl",p.order_id::text as "orderId",o.daily_no as "dailyNo",p.discrepancy_code as "discrepancyCode"
      from provider_payment_intents p left join orders o on o.id=p.order_id and o.shop_id=p.shop_id
      where p.shop_id=${shopId}::uuid and p.self_order_id=${draftId}::uuid`;
    return row ? { ...row, configured: !!config } : { id: null, configured: !!config, testMode: config?.testMode ?? null, status: "not_started", amountSatang: null, qrImageUrl: null, orderId: null, dailyNo: null, discrepancyCode: null };
  }

  async get(shopId: string, actor: string, draftId: string): Promise<ProviderPaymentView> {
    if (!UUID.test(draftId)) { throw new BadRequestException("Invalid draft"); }
    return this.database.connection.begin(async (tx) => {
      await requireStaff(tx, shopId, actor);
      const [draft] = await tx`select id from self_orders where shop_id=${shopId}::uuid and id=${draftId}::uuid`;
      if (!draft) { throw new NotFoundException("Self-order not found"); }
      return this.view(tx, shopId, draftId);
    });
  }

  async create(shopId: string, actor: string, draftId: string): Promise<ProviderPaymentView> {
    if (!UUID.test(draftId)) { throw new BadRequestException("Invalid draft"); }
    const config = merchant(shopId);
    if (!config) { throw new ConflictException("Provider payments are not configured for this shop"); }
    const created = await this.database.connection.begin(async (tx) => {
      await tx`select id from shops where id=${shopId}::uuid for share`;
      await requireStaff(tx, shopId, actor);
      const [draft] = await tx<{ status: string; lines: CheckoutInput["lines"]; total_satang: number }[]>`select status,lines,total_satang from self_orders
        where shop_id=${shopId}::uuid and id=${draftId}::uuid for update`;
      if (!draft) { throw new NotFoundException("Self-order not found"); }
      const [existing] = await tx`select id from provider_payment_intents where shop_id=${shopId}::uuid and self_order_id=${draftId}::uuid`;
      if (existing) { return null; }
      if (draft.status !== "accepted") { throw new ConflictException("Only accepted self-orders can request a provider QR"); }
      if (draft.total_satang < 2000 || draft.total_satang > 15000000) { throw new BadRequestException("Provider PromptPay amount is outside supported limits"); }
      const id = randomUUID();
      const input: CheckoutInput = { requestId: id, selfOrderId: draftId, lines: draft.lines, expectedTotalSatang: draft.total_satang, payment: { method: "promptpay" } };
      const [intent] = await tx<Intent[]>`insert into provider_payment_intents(id,shop_id,self_order_id,staff_id,amount_satang,test_mode,checkout_input)
        values(${id}::uuid,${shopId}::uuid,${draftId}::uuid,${actor}::uuid,${draft.total_satang},${config.testMode},${tx.json(input as never)}) returning *`;
      return intent;
    });
    if (!created) { return this.get(shopId, actor, draftId); }
    // The intent is committed before any network call. Only this creator may POST a charge.
    try {
      const accountId = await account(config);
      await this.database.connection`update provider_payment_intents set provider_account_id=${accountId} where id=${created.id}::uuid`;
      const form = new URLSearchParams({ amount: String(created.amount_satang), currency: "thb", "source[type]": "promptpay", ref_id: created.id,
        "metadata[shop_id]": shopId, "metadata[draft_id]": draftId, "metadata[intent_id]": created.id });
      const charge = await provider(config, "/charges", form);
      await this.applyCharge(created.id, accountId, charge);
    } catch {
      await this.database.connection`update provider_payment_intents set status='uncertain',discrepancy_code='creation_uncertain',updated_at=clock_timestamp()
        where id=${created.id}::uuid and status='creating'`;
      this.logger.warn("Provider creation needs status recovery; no replacement charge will be created");
    }
    return this.get(shopId, actor, draftId);
  }

  private async applyCharge(intentId: string, accountId: string, charge: Json): Promise<void> {
    const [found] = await this.database.connection<Intent[]>`select * from provider_payment_intents where id=${intentId}::uuid`;
    if (!found) { return; }
    const verified = await this.database.connection.begin(async (tx) => {
      // Match checkout's draft -> intent lock order.
      await tx`select id from self_orders where id=${found.self_order_id}::uuid and shop_id=${found.shop_id}::uuid for update`;
      const [intent] = await tx<Intent[]>`select * from provider_payment_intents where id=${intentId}::uuid for update`;
      if (intent.status === "completed") { return false; }
      const metadata = object(charge.metadata);
      const problem = intent.provider_account_id !== accountId ? "merchant_mismatch"
        : charge.object !== "charge" || typeof charge.id !== "string" || !CHARGE.test(charge.id) ? "invalid_charge"
        : charge.livemode !== !intent.test_mode ? "mode_mismatch"
        : intent.provider_charge_id && intent.provider_charge_id !== charge.id ? "charge_mismatch"
        : metadata.shop_id !== intent.shop_id || metadata.draft_id !== intent.self_order_id || metadata.intent_id !== intent.id || charge.ref_id !== intent.id ? "metadata_mismatch"
        : charge.amount !== intent.amount_satang ? "amount_mismatch"
        : typeof charge.currency !== "string" || charge.currency.toLowerCase() !== intent.currency.toLowerCase() ? "currency_mismatch"
        : object(charge.source).type !== "promptpay" ? "payment_method_mismatch" : null;
      if (problem) {
        await tx`update provider_payment_intents set status='discrepancy',discrepancy_code=${problem},qr_image_url=null,updated_at=clock_timestamp() where id=${intentId}::uuid`;
        return false;
      }
      const paid = charge.status === "successful" && charge.paid === true;
      const status = paid ? "verified" : charge.paid === true ? "discrepancy"
        : charge.status === "pending" ? "pending" : charge.status === "failed" ? "failed" : charge.status === "expired" ? "expired" : "discrepancy";
      await tx`update provider_payment_intents set provider_charge_id=${charge.id as string},status=${status},
        qr_image_url=${status === "pending" ? qrUrl(charge) : null},discrepancy_code=${status === "discrepancy" ? "unexpected_charge_status" : null},
        verified_at=${paid ? new Date() : intent.verified_at},updated_at=clock_timestamp() where id=${intentId}::uuid`;
      return paid;
    });
    if (verified) { await this.fulfill(intentId); }
  }

  private async fulfill(intentId: string): Promise<void> {
    const [intent] = await this.database.connection<Intent[]>`select * from provider_payment_intents where id=${intentId}::uuid`;
    if (!intent || !intent.verified_at || !["verified", "paid_unfulfilled"].includes(intent.status)) { return; }
    try {
      const receipt = await this.orders.checkout(intent.shop_id, intent.staff_id, intent.checkout_input, intent.id);
      await this.database.connection`update provider_payment_intents set status='completed',order_id=${receipt.orderId}::uuid,
        discrepancy_code=null,updated_at=clock_timestamp() where id=${intentId}::uuid and verified_at is not null`;
    } catch {
      await this.database.connection`update provider_payment_intents set status='paid_unfulfilled',discrepancy_code='checkout_failed',updated_at=clock_timestamp()
        where id=${intentId}::uuid and status in ('verified','paid_unfulfilled')`;
      this.logger.warn("Verified provider payment requires checkout fulfillment review");
    }
  }

  async refresh(shopId: string, actor: string, draftId: string): Promise<ProviderPaymentView> {
    const view = await this.get(shopId, actor, draftId);
    if (!view.id || view.status === "completed") { return view; }
    const config = merchant(shopId);
    if (!config) { throw new ServiceUnavailableException("Provider configuration unavailable"); }
    const [intent] = await this.database.connection<Intent[]>`select * from provider_payment_intents where id=${view.id}::uuid`;
    try {
      const accountId = await account(config);
      if (config.testMode !== intent.test_mode || (intent.provider_account_id && intent.provider_account_id !== accountId)) {
        await this.database.connection`update provider_payment_intents set status='discrepancy',discrepancy_code='merchant_mismatch',qr_image_url=null where id=${intent.id}::uuid`;
        return this.get(shopId, actor, draftId);
      }
      if (!intent.provider_account_id) {
        await this.database.connection`update provider_payment_intents set provider_account_id=${accountId} where id=${intent.id}::uuid and provider_account_id is null`;
      }
      if (intent.provider_charge_id) {
        await this.applyCharge(intent.id, accountId, await provider(config, `/charges/${intent.provider_charge_id}`));
      } else {
        // No undocumented lookup or second POST: bounded authenticated list recovery by immutable ref_id.
        const from = new Date(intent.created_at.getTime() - 60000).toISOString();
        const result = await provider(config, `/charges?${new URLSearchParams({ from, limit: "100", order: "reverse_chronological" })}`);
        const matches = Array.isArray(result.data) ? result.data.map(object).filter((charge) => charge.ref_id === intent.id) : [];
        if (matches.length === 1 && typeof matches[0].id === "string" && CHARGE.test(matches[0].id)) {
          await this.applyCharge(intent.id, accountId, await provider(config, `/charges/${matches[0].id}`));
        } else {
          await this.database.connection`update provider_payment_intents set status='uncertain',discrepancy_code='charge_not_located',updated_at=clock_timestamp()
            where id=${intent.id}::uuid and status in ('creating','uncertain')`;
        }
      }
    } catch { throw new ServiceUnavailableException("Provider status temporarily unavailable; do not collect again"); }
    return this.get(shopId, actor, draftId);
  }

  async webhook(shopId: string, eventId: unknown): Promise<{ accepted: true }> {
    if (!UUID.test(shopId) || typeof eventId !== "string" || !EVENT.test(eventId)) { return { accepted: true }; }
    const config = merchant(shopId);
    if (!config) { return { accepted: true }; }
    let event: Json;
    try { event = await provider(config, `/events/${eventId}`); }
    catch (error) {
      if (error instanceof ProviderFailure && error.status === 404) { return { accepted: true }; }
      throw new ServiceUnavailableException("Provider verification unavailable");
    }
    if (event.object !== "event" || event.id !== eventId || event.livemode !== !config.testMode || !["charge.complete", "charge.create", "charge.update"].includes(String(event.key))) { return { accepted: true }; }
    const chargeId = object(event.data).id;
    if (typeof chargeId !== "string" || !CHARGE.test(chargeId)) { return { accepted: true }; }
    const charge = await provider(config, `/charges/${chargeId}`);
    const intentId = object(charge.metadata).intent_id;
    if (typeof intentId !== "string" || !UUID.test(intentId)) { return { accepted: true }; }
    const [intent] = await this.database.connection<Intent[]>`select * from provider_payment_intents where id=${intentId}::uuid and shop_id=${shopId}::uuid`;
    if (!intent) { return { accepted: true }; }
    await this.applyCharge(intent.id, await account(config), charge);
    await this.database.connection`insert into provider_webhook_events(shop_id,event_id,intent_id,outcome)
      values(${shopId}::uuid,${eventId},${intent.id}::uuid,'verified_resource') on conflict (shop_id,event_id) do nothing`;
    return { accepted: true };
  }
}
