import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import type { CheckoutCartLine } from "./checkout-domain.js";
import { DatabaseService } from "./database.service.js";
import { OrdersService } from "./orders.service.js";
export interface TrialCheckoutInput { lines: CheckoutCartLine[]; method: "cash" | "promptpay" }
export interface TrialCheckoutSummary { totalSatang: number; itemCount: number; method: "cash" | "promptpay" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class TrialRollback extends Error {
  constructor(readonly summary: TrialCheckoutSummary) { super("Setup trial must roll back"); }
}
async function requireManager(tx: TransactionSql, shop: string, actor: string) {
  const [staff] = await tx`select id from staff where id=${actor}::uuid and shop_id=${shop}::uuid
    and is_active=true and role in ('owner','manager') for share`;
  if (!staff) { throw new ForbiddenException("Active shop owner or manager required"); }
}
function validate(input: TrialCheckoutInput) {
  if (!input || !["cash", "promptpay"].includes(input.method) || !Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100
    || input.lines.some((line) => !line || !UUID.test(line.productId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99
      || !Array.isArray(line.modifierIds) || line.modifierIds.length > 30 || line.modifierIds.some((id) => !UUID.test(id))
      || (line.note !== undefined && (typeof line.note !== "string" || line.note.length > 120)))
    || input.lines.reduce((total, line) => total + line.qty, 0) > 500) {
    throw new BadRequestException("Invalid trial cart");
  }
}

@Injectable()
export class TrialCheckoutService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async run(shop: string, actor: string, input: TrialCheckoutInput): Promise<TrialCheckoutSummary> {
    let summary: TrialCheckoutSummary;
    try {
      await this.database.connection.begin(async (tx) => {
        await requireManager(tx, shop, actor);
        validate(input);
        // Both real service transactions execute on this outer transaction, never COMMIT independently.
        const connection = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === "begin") { return async (callback: (scoped: TransactionSql) => Promise<unknown>) => callback(tx); }
            return Reflect.get(target, property, receiver);
          },
        }) as unknown as Sql;
        const scopedDatabase = Object.defineProperty(Object.create(this.database), "connection", { value: connection }) as DatabaseService;
        const orders = new OrdersService(scopedDatabase);
        const quote = await orders.quote(shop, actor, { lines: input.lines, payment: { method: "promptpay" } });
        const receipt = await orders.checkout(shop, actor, {
          requestId: randomUUID(), lines: input.lines, expectedTotalSatang: quote.totalSatang,
          payment: input.method === "cash" ? { method: "cash", cashReceivedSatang: quote.totalSatang } : { method: "promptpay" },
        });
        throw new TrialRollback({ totalSatang: receipt.totalSatang, itemCount: input.lines.reduce((total, line) => total + line.qty, 0), method: input.method });
      });
      throw new Error("Trial transaction did not roll back");
    } catch (error) {
      // postgres.js awaits ROLLBACK before propagating this sentinel. Rollback/connection errors are never success.
      if (!(error instanceof TrialRollback)) { throw error; }
      summary = error.summary;
    }
    await this.database.connection.begin(async (tx) => {
      await requireManager(tx, shop, actor);
      await tx`insert into audit_log(shop_id,actor,action,payload)
        values(${shop}::uuid,${actor},'setup.trial-checkout',${tx.json({ ...summary })})`;
    });
    return summary;
  }
}
