import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TransactionSql } from "postgres";
import { calculatePrice, CheckoutDomainError, type CheckoutCartLine } from "./checkout-domain.js";
import { DatabaseService } from "./database.service.js";
import { checkoutMenu } from "./orders.service.js";
import { requireShopFeature } from "./subscriptions.service.js";
import { clearExpiredSoldOut } from "./sold-out.js";

export interface SelfOrderInput { clientKey: string; statusToken: string; mode: "pickup" | "table"; tableLabel: string | null; lines: CheckoutCartLine[] }
export interface SelfOrderView {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  totalSatang: number;
  dailyNo: number | null;
  mode: "pickup" | "table";
  tableLabel: string | null;
  items: { id: string; name: string; qty: number; note: string | null; modifiers: string[]; lineTotalSatang: number }[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function canonicalLines(lines: CheckoutCartLine[]) {
  return lines.map((line) => ({ productId: line.productId.toLowerCase(), qty: line.qty, modifierIds: line.modifierIds.map((id) => id.toLowerCase()).sort(), ...(line.note?.trim() ? { note: line.note.trim() } : {}) }));
}
function validate(input: SelfOrderInput) {
  if (!input || !UUID.test(input.clientKey) || !TOKEN.test(input.statusToken)
    || !["pickup", "table"].includes(input.mode) || (input.tableLabel !== null && typeof input.tableLabel !== "string")
    || (input.tableLabel?.length ?? 0) > 40 || (input.mode === "table" && !input.tableLabel?.trim())
    || (input.mode === "pickup" && input.tableLabel !== null)
    || !Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 30
    || input.lines.some((line) => !line || !UUID.test(line.productId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99
      || !Array.isArray(line.modifierIds) || line.modifierIds.length > 30 || line.modifierIds.some((id) => !UUID.test(id))
      || (line.note !== undefined && (typeof line.note !== "string" || line.note.length > 120)))
    || input.lines.reduce((total, line) => total + line.qty, 0) > 100) {
    throw new BadRequestException("Invalid self-order cart");
  }
}
async function requireStaff(tx: TransactionSql, shopId: string, actor: string) {
  const [staff] = await tx`select id from staff where id=${actor}::uuid and shop_id=${shopId}::uuid
    and is_active=true and role in ('owner','manager','barista') for share`;
  if (!staff) { throw new ForbiddenException("Active shop staff required"); }
}
async function price(tx: TransactionSql, shopId: string, lines: CheckoutCartLine[]) {
  await clearExpiredSoldOut(tx, shopId);
  try { return calculatePrice(lines, await checkoutMenu(tx, shopId)); }
  catch (error) {
    if (error instanceof CheckoutDomainError) { throw new BadRequestException({ code: error.code }); }
    throw error;
  }
}
async function view(tx: TransactionSql, shopId: string, id: string): Promise<SelfOrderView> {
  const [row] = await tx<SelfOrderView[]>`select d.id::text as id,d.status,d.total_satang as "totalSatang",
    d.mode,d.table_label as "tableLabel",d.items,o.daily_no as "dailyNo"
    from self_orders d left join orders o on o.id=d.order_id and o.shop_id=d.shop_id
    where d.shop_id=${shopId}::uuid and d.id=${id}::uuid`;
  if (!row) { throw new NotFoundException("Self-order not found"); }
  return row;
}

// Call only after ordinary checkout request-key replay, and before creating a NEW order.
export async function lockSelfOrderForCheckout(tx: TransactionSql, shopId: string, actor: string, id: string, lines: CheckoutCartLine[], expectedTotalSatang?: number, providerIntentId?: string) {
  await requireStaff(tx, shopId, actor);
  const [draft] = await tx<{ status: string; lines: CheckoutCartLine[]; total: number }[]>`select status,lines,total_satang as total
    from self_orders where id=${id}::uuid and shop_id=${shopId}::uuid for update`;
  if (!draft) { throw new NotFoundException("Self-order not found"); }
  if (draft.status !== "accepted" || (expectedTotalSatang !== undefined && draft.total !== expectedTotalSatang)
    || JSON.stringify(canonicalLines(draft.lines)) !== JSON.stringify(canonicalLines(lines))) {
    throw new ConflictException({ code: "self_order_unavailable" });
  }
  const [intent] = await tx`select id::text,status,verified_at,staff_id,amount_satang from provider_payment_intents
    where shop_id=${shopId}::uuid and self_order_id=${id}::uuid for update`;
  if (providerIntentId) {
    if (!intent || intent.id !== providerIntentId || !intent.verified_at
      || !['verified', 'paid_unfulfilled'].includes(intent.status) || intent.staff_id !== actor || intent.amount_satang !== draft.total) {
      throw new ConflictException({ code: "provider_payment_not_verified" });
    }
  } else if (intent && !['failed', 'expired'].includes(intent.status)) {
    throw new ConflictException({ code: "provider_payment_in_progress" });
  }
  return draft.total;
}
// Same transaction as the paid order insert; no API exposes this helper.
export async function completeSelfOrderCheckout(tx: TransactionSql, shopId: string, id: string, orderId: string, providerIntentId?: string) {
  const rows = await tx`update self_orders d set status='completed',order_id=${orderId}::uuid,updated_at=clock_timestamp()
    where d.id=${id}::uuid and d.shop_id=${shopId}::uuid and d.status='accepted'
      and exists(select 1 from orders o where o.id=${orderId}::uuid and o.shop_id=d.shop_id and o.status='paid') returning d.id`;
  if (!rows.length) { throw new ConflictException("Unable to settle self-order"); }
  if (providerIntentId) {
    const linked = await tx`update provider_payment_intents set status='completed',order_id=${orderId}::uuid,discrepancy_code=null,updated_at=clock_timestamp()
      where id=${providerIntentId}::uuid and shop_id=${shopId}::uuid and self_order_id=${id}::uuid
        and verified_at is not null and status in ('verified','paid_unfulfilled') returning id`;
    if (!linked.length) { throw new ConflictException("Provider payment linkage failed"); }
  }
}

@Injectable()
export class SelfOrdersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async submit(shopId: string, input: SelfOrderInput): Promise<SelfOrderView> {
    validate(input);
    const lines = canonicalLines(input.lines);
    const tableLabel = input.tableLabel?.trim() ?? null;
    const fingerprint = hash(JSON.stringify({ lines, mode: input.mode, tableLabel }));
    const tokenHash = hash(input.statusToken);
    return this.database.connection.begin(async (tx) => {
      const [shop] = await tx`select id from shops where id=${shopId}::uuid for share`;
      if (!shop) { throw new NotFoundException("Shop not found"); }
      await tx`select pg_advisory_xact_lock(hashtextextended(${`self-order:${shopId}:${input.clientKey.toLowerCase()}`},0))`;
      const [existing] = await tx`select id,fingerprint,token_hash from self_orders where shop_id=${shopId}::uuid and client_key=${input.clientKey}::uuid`;
      if (existing) {
        if (existing.fingerprint !== fingerprint || existing.token_hash !== tokenHash) { throw new ConflictException("Self-order key already used"); }
        return view(tx, shopId, existing.id as string);
      }
      await requireShopFeature(tx, shopId, "self-order");
      const priced = await price(tx, shopId, lines);
      const items = priced.lines.map((line) => ({ id: randomUUID(), name: line.name, qty: line.qty, note: line.note, modifiers: line.modifiers.map((modifier) => modifier.name), lineTotalSatang: line.lineTotalSatang }));
      const [row] = await tx`insert into self_orders(shop_id,client_key,token_hash,fingerprint,mode,table_label,lines,items,total_satang)
        values(${shopId}::uuid,${input.clientKey}::uuid,${tokenHash},${fingerprint},${input.mode},${tableLabel},${tx.json(lines)},${tx.json(items)},${priced.subtotalSatang}) returning id`;
      return view(tx, shopId, row.id as string);
    });
  }

  async status(shopId: string, token: string): Promise<SelfOrderView> {
    if (!TOKEN.test(token)) { throw new NotFoundException("Self-order not found"); }
    return this.database.connection.begin(async (tx) => {
      const [row] = await tx`select id from self_orders where shop_id=${shopId}::uuid and token_hash=${hash(token)}`;
      if (!row) { throw new NotFoundException("Self-order not found"); }
      return view(tx, shopId, row.id as string);
    });
  }

  async list(shopId: string, actor: string): Promise<SelfOrderView[]> {
    return this.database.connection.begin(async (tx) => {
      await requireStaff(tx, shopId, actor);
      return tx<SelfOrderView[]>`select id::text as id,status,total_satang as "totalSatang",mode,table_label as "tableLabel",items,null::integer as "dailyNo"
        from self_orders where shop_id=${shopId}::uuid and status in ('pending','accepted') order by created_at,id limit 100`;
    });
  }

  async decide(shopId: string, actor: string, id: string, decision: "accepted" | "rejected") {
    return this.database.connection.begin(async (tx) => {
      await requireStaff(tx, shopId, actor);
      if (!["accepted", "rejected"].includes(decision)) { throw new BadRequestException("Invalid decision"); }
      const [draft] = await tx<{ status: string; lines: CheckoutCartLine[]; total: number }[]>`select status,lines,total_satang as total
        from self_orders where id=${id}::uuid and shop_id=${shopId}::uuid for update`;
      if (!draft) { throw new NotFoundException("Self-order not found"); }
      if (draft.status === decision) { return view(tx, shopId, id); }
      if (draft.status !== "pending") { throw new ConflictException("Self-order already handled"); }
      if (decision === "accepted" && (await price(tx, shopId, draft.lines)).subtotalSatang !== draft.total) {
        throw new ConflictException("Menu price changed; request a new customer order");
      }
      await tx`update self_orders set status=${decision},decided_by=${actor}::uuid,updated_at=clock_timestamp()
        where id=${id}::uuid and shop_id=${shopId}::uuid`;
      return view(tx, shopId, id);
    });
  }

  async getAcceptedDraft(shopId: string, actor: string, id: string): Promise<{ lines: CheckoutCartLine[]; totalSatang: number }> {
    return this.database.connection.begin(async (tx) => {
      await requireStaff(tx, shopId, actor);
      const [draft] = await tx<{ lines: CheckoutCartLine[]; totalSatang: number }[]>`select lines,total_satang as "totalSatang"
        from self_orders where id=${id}::uuid and shop_id=${shopId}::uuid and status='accepted'`;
      if (!draft) { throw new NotFoundException("Accepted self-order not found"); }
      return draft;
    });
  }
}
