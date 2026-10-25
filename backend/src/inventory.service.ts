import { recipeRequirements } from './recipe-domain.js';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";
import { requireShopFeature } from "./subscriptions.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Connection = Sql | TransactionSql;
export type InventoryUnit = "g" | "ml" | "unit";
export interface IngredientInput { name: string; unit: InventoryUnit; lowStockMilliunits: number }
export interface RecipeInput { ingredientId: string; quantityMilliunits: number; replacesIngredientId?: string | null }
export interface MovementInput { requestId: string; kind: "receive" | "waste" | "adjust"; quantityMilliunits: number; reason: string; costSatang?: number | null }
export interface IngredientRow { id: string; name: string; unit: InventoryUnit; lowStockMilliunits: number; onHandMilliunits: number; reservedMilliunits: number; availableMilliunits: number; lowStock: boolean }
export interface RecipeRow extends RecipeInput { targetKind: "product" | "modifier"; targetId: string }
export interface InventoryMovementRow { costSatang: number | null; id: string; ingredientId: string; kind: "receive" | "waste" | "adjust" | "sale" | "remake"; quantityMilliunits: number; reason: string; actorStaffId: string | null; orderId: string | null; createdAt: string }
export interface InventoryTarget { id: string; name: string; kind: "product" | "modifier" }
export interface InventoryState { ingredients: IngredientRow[]; recipes: RecipeRow[]; targets: InventoryTarget[]; movements: InventoryMovementRow[] }

function ids(...values: string[]) {
  if (values.some((value) => !UUID.test(value))) { throw new BadRequestException("Invalid identifier"); }
}
function quantity(value: number, zeroAllowed = false) {
  if (!Number.isSafeInteger(value) || value < (zeroAllowed ? 0 : 1) || value > 2147483647) { throw new BadRequestException("Invalid inventory quantity"); }
}
async function requireActor(sql: Connection, shopId: string, actorId: string, manager: boolean) {
  ids(shopId, actorId);
  const [actor] = await sql`select role from staff where id=${actorId}::uuid and shop_id=${shopId}::uuid and is_active=true for share`;
  if (!actor || (manager && actor.role !== "owner" && actor.role !== "manager")) { throw new ForbiddenException("Inventory access denied"); }
}
async function recipes(sql: Connection, shopId: string): Promise<RecipeRow[]> {
  return sql<RecipeRow[]>`select 'product' as "targetKind", r.product_id::text as "targetId", r.ingredient_id::text as "ingredientId", r.quantity_milliunits as "quantityMilliunits", null::text as "replacesIngredientId"
    from recipe_lines r join ingredients i on i.id=r.ingredient_id and i.shop_id=r.shop_id
    join products p on p.id=r.product_id and p.shop_id=r.shop_id where r.shop_id=${shopId}::uuid
    union all
    select 'modifier',r.modifier_id::text,r.ingredient_id::text,r.quantity_milliunits,r.replaces_ingredient_id::text
    from modifier_recipe_lines r join ingredients i on i.id=r.ingredient_id and i.shop_id=r.shop_id
    join modifiers m on m.id=r.modifier_id join modifier_groups g on g.id=m.group_id and g.shop_id=r.shop_id
    where r.shop_id=${shopId}::uuid`;
}

export async function reservePromptPayRecipeStock(tx: TransactionSql, shopId: string, staffId: string,
  requestId: string, fingerprint: string, lines: { productId: string; qty: number; modifierIds: string[] }[]): Promise<string> {
  ids(shopId, staffId, requestId);
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const modifierIds = [...new Set(lines.flatMap((line) => line.modifierIds))];
  ids(...productIds, ...modifierIds);
  for (const line of lines) { quantity(line.qty); }
  const products = await tx`select id from products where shop_id=${shopId}::uuid and id=any(${productIds}::uuid[])`;
  const modifiers = await tx`select m.id from modifiers m join modifier_groups g on g.id=m.group_id
    where g.shop_id=${shopId}::uuid and m.id=any(${modifierIds}::uuid[])`;
  if (products.length !== productIds.length || modifiers.length !== modifierIds.length) { throw new NotFoundException("Recipe target not found"); }

  const configured = await recipes(tx, shopId);
  const amounts = recipeRequirements(configured, lines);
  const ingredientIds = [...amounts.keys()].sort();
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${ingredientIds}::uuid[]) order by id for update`;
  await tx`delete from promptpay_stock_holds where shop_id=${shopId}::uuid and expires_at <= now()`;
  const [existing] = await tx<{ fingerprint: string; expiresAt: string }[]>`
    select fingerprint,expires_at::text as "expiresAt" from promptpay_stock_holds
    where shop_id=${shopId}::uuid and request_id=${requestId}::uuid for update`;
  if (existing && existing.fingerprint !== fingerprint) { throw new ConflictException({ code: "idempotency_key_reused" }); }

  if (ingredientIds.length) {
    const balances = await tx<{ id: string; onHand: number; held: number }[]>`select i.id::text as id,
        (coalesce(sum(m.quantity_milliunits),0) - coalesce((select sum(oh.quantity_milliunits) from order_stock_holds oh where oh.shop_id=i.shop_id and oh.ingredient_id=i.id),0))::float8 as "onHand",
        coalesce((select sum(h.quantity_milliunits) from promptpay_stock_hold_items h
          join promptpay_stock_holds hh on hh.shop_id=h.shop_id and hh.request_id=h.request_id
          where h.shop_id=i.shop_id and h.ingredient_id=i.id and hh.expires_at>now()
            and h.request_id<>${requestId}::uuid),0)::float8 as held
      from ingredients i left join inventory_movements m on m.ingredient_id=i.id and m.shop_id=i.shop_id
      where i.shop_id=${shopId}::uuid and i.id=any(${ingredientIds}::uuid[]) group by i.id order by i.id`;
    const balanceById = new Map(balances.map((row) => [row.id, row]));
    for (const ingredientId of ingredientIds) {
      const row = balanceById.get(ingredientId);
      if (!row || !Number.isSafeInteger(row.onHand) || !Number.isSafeInteger(row.held)
        || row.onHand - row.held < amounts.get(ingredientId)!) {
        throw new ConflictException({ code: "insufficient_recipe_stock", ingredientId });
      }
    }
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  if (existing) {
    await tx`update promptpay_stock_holds set expires_at=${expiresAt} where shop_id=${shopId}::uuid and request_id=${requestId}::uuid`;
  } else {
    await tx`insert into promptpay_stock_holds(shop_id,request_id,staff_id,fingerprint,expires_at)
      values (${shopId}::uuid,${requestId}::uuid,${staffId}::uuid,${fingerprint},${expiresAt})`;
    for (const [ingredientId, amount] of amounts) {
      await tx`insert into promptpay_stock_hold_items(shop_id,request_id,ingredient_id,quantity_milliunits)
        values (${shopId}::uuid,${requestId}::uuid,${ingredientId}::uuid,${amount})`;
    }
  }
  return expiresAt;
}

/** Call in the checkout transaction. Recipes apply once and cannot spend stock below zero. */
export async function deductRecipeStock(tx: TransactionSql, shopId: string, orderId: string,
  lines: { productId: string; qty: number; modifierIds: string[] }[], requestId?: string): Promise<void> {
  ids(shopId, orderId);
  await tx`select id from shops where id=${shopId}::uuid for share`;
  const [order] = await tx`select inventory_deducted_at,staff_id from orders where id=${orderId}::uuid and shop_id=${shopId}::uuid for update`;
  if (!order) { throw new NotFoundException("Order not found"); }
  if (order.inventory_deducted_at) { return; }
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const modifierIds = [...new Set(lines.flatMap((line) => line.modifierIds))];
  ids(...productIds, ...modifierIds);
  for (const line of lines) { quantity(line.qty); }
  const products = await tx`select id from products where shop_id=${shopId}::uuid and id=any(${productIds}::uuid[])`;
  const modifiers = await tx`select m.id from modifiers m join modifier_groups g on g.id=m.group_id
    where g.shop_id=${shopId}::uuid and m.id=any(${modifierIds}::uuid[])`;
  if (products.length !== productIds.length || modifiers.length !== modifierIds.length) { throw new NotFoundException("Recipe target not found"); }
  const configured = await recipes(tx, shopId);
  const amounts = recipeRequirements(configured, lines);
  const ingredientIds = [...amounts.keys()].sort();
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${ingredientIds}::uuid[]) order by id for update`;
  const balances = await tx<{ id: string; onHand: number; held: number }[]>`select i.id::text as id,
      (coalesce(sum(m.quantity_milliunits),0) - coalesce((select sum(oh.quantity_milliunits) from order_stock_holds oh where oh.shop_id=i.shop_id and oh.ingredient_id=i.id),0))::float8 as "onHand",
      coalesce((select sum(h.quantity_milliunits) from promptpay_stock_hold_items h
        join promptpay_stock_holds hh on hh.shop_id=h.shop_id and hh.request_id=h.request_id
        where h.shop_id=i.shop_id and h.ingredient_id=i.id and hh.expires_at>now()
          and (${requestId ?? null}::uuid is null or h.request_id<>${requestId ?? null}::uuid)),0)::float8 as held
    from ingredients i left join inventory_movements m on m.ingredient_id=i.id and m.shop_id=i.shop_id
    where i.shop_id=${shopId}::uuid and i.id=any(${ingredientIds}::uuid[]) group by i.id order by i.id`;
  const balanceById = new Map(balances.map((row) => [row.id, row]));
  for (const ingredientId of ingredientIds) {
    const balance = balanceById.get(ingredientId);
    const required = amounts.get(ingredientId)!;
    if (!balance || !Number.isSafeInteger(balance.onHand) || !Number.isSafeInteger(balance.held)
      || balance.onHand - balance.held < required) {
      throw new ConflictException({ code: "insufficient_recipe_stock", ingredientId });
    }
    await tx`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,order_id)
      values (${shopId}::uuid,${ingredientId}::uuid,'sale',${-required},${order.staff_id}::uuid,'Recipe consumption',${orderId}::uuid)
      on conflict (order_id,ingredient_id) where kind='sale' do nothing`;
  }
  if (requestId) {
    await tx`delete from promptpay_stock_holds where shop_id=${shopId}::uuid and request_id=${requestId}::uuid`;
  }
  await tx`update orders set inventory_deducted_at=clock_timestamp() where id=${orderId}::uuid`;
}

/** Checkout snapshots recipes before transferring the temporary payment hold. */
export async function reserveOrderRecipeStock(tx: TransactionSql, shopId: string, orderId: string,
  lines: { productId: string; qty: number; modifierIds: string[] }[], itemIds: string[], requestId?: string) {
  const [order] = await tx`select o.recipe_snapshot_at,o.staff_id,s.stock_consumption from orders o join shops s on s.id=o.shop_id
    where o.id=${orderId}::uuid and o.shop_id=${shopId}::uuid for update of o`;
  if (!order) throw new NotFoundException('Order not found');
  if (order.recipe_snapshot_at) return;
  const configured = await recipes(tx, shopId);
  const amounts = recipeRequirements(configured, lines);
  await availableStock(tx, shopId, amounts, requestId);
  for (const [index, line] of lines.entries()) {
    for (const [ingredientId, amount] of recipeRequirements(configured, [{ ...line, qty: 1 }])) {
      await tx`insert into order_item_recipes(order_item_id,ingredient_id,quantity_milliunits,unit_cost_satang)
        select ${itemIds[index]}::uuid,${ingredientId}::uuid,${amount},average_cost_per_milliunit*${amount} from ingredients where id=${ingredientId}::uuid and shop_id=${shopId}::uuid`;
    }
  }
  await tx`update order_items i set unit_cost_satang=c.unit_cost, cost_satang=round(c.unit_cost*i.qty)
    from (select order_item_id,case when count(*)=count(unit_cost_satang) then sum(unit_cost_satang) else null end as unit_cost
      from order_item_recipes where order_item_id=any(${itemIds}::uuid[]) group by order_item_id) c where i.id=c.order_item_id`;
  for (const [ingredientId, amount] of amounts) {
    await tx`insert into order_stock_holds(shop_id,order_id,ingredient_id,quantity_milliunits)
      values(${shopId}::uuid,${orderId}::uuid,${ingredientId}::uuid,${amount})`;
  }
  await tx`update orders set recipe_snapshot_at=clock_timestamp(),stock_consumption=${order.stock_consumption} where id=${orderId}::uuid`;
  if (requestId) await tx`delete from promptpay_stock_holds where shop_id=${shopId}::uuid and request_id=${requestId}::uuid`;
  if (order.stock_consumption === 'payment') await consumeOrderStock(tx, shopId, orderId);
}

async function availableStock(tx: TransactionSql, shopId: string, amounts: Map<string, number>, requestId?: string) {
  const ingredientIds = [...amounts.keys()].sort();
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${ingredientIds}::uuid[]) order by id for update`;
  for (const [ingredientId, amount] of amounts) {
    const [row] = await tx`select
      (coalesce((select sum(quantity_milliunits) from inventory_movements where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid),0)
      -coalesce((select sum(quantity_milliunits) from order_stock_holds where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid),0)
      -coalesce((select sum(h.quantity_milliunits) from promptpay_stock_hold_items h join promptpay_stock_holds hh using(shop_id,request_id)
        where h.shop_id=${shopId}::uuid and h.ingredient_id=${ingredientId}::uuid and hh.expires_at>now()
        and (${requestId ?? null}::uuid is null or h.request_id<>${requestId ?? null}::uuid)),0))::float8 as available`;
    if (!Number.isSafeInteger(row.available) || row.available < amount) throw new ConflictException({ code: 'insufficient_recipe_stock', ingredientId });
  }
}

export async function consumeOrderStock(tx: TransactionSql, shopId: string, orderId: string, actorStaffId?: string) {
  const [order] = await tx`select inventory_deducted_at,recipe_snapshot_at,staff_id from orders
    where id=${orderId}::uuid and shop_id=${shopId}::uuid for update`;
  // Historical bills have no recipe snapshot and must never consume today's recipe.
  if (!order || order.inventory_deducted_at || !order.recipe_snapshot_at) return;
  const holds = await tx`select ingredient_id,quantity_milliunits::float8 as qty from order_stock_holds where shop_id=${shopId}::uuid and order_id=${orderId}::uuid order by ingredient_id`;
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${holds.map(row => row.ingredient_id)}::uuid[]) order by id for update`;
  await tx`update order_items i set prepared_qty=i.qty-coalesce((select sum((line->>'qty')::int) from refunds r
    cross join lateral jsonb_array_elements(r.lines) line where r.order_id=i.order_id and r.shop_id=${shopId}::uuid
      and line->>'itemId'=i.id::text),0) where i.order_id=${orderId}::uuid`;
  for (const hold of holds) {
    await tx`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,order_id)
      values(${shopId}::uuid,${hold.ingredient_id}::uuid,'sale',${-hold.qty},${actorStaffId ?? order.staff_id}::uuid,'Recipe consumption',${orderId}::uuid)`;
    await tx`update inventory_movements set cost_satang=(select case when count(*)=count(r.unit_cost_satang) then round(sum(r.unit_cost_satang*i.prepared_qty)) else null end
      from order_item_recipes r join order_items i on i.id=r.order_item_id where i.order_id=${orderId}::uuid and r.ingredient_id=${hold.ingredient_id}::uuid and i.prepared_qty>0)
      where order_id=${orderId}::uuid and ingredient_id=${hold.ingredient_id}::uuid and kind='sale'`;
  }
  await tx`delete from order_stock_holds where shop_id=${shopId}::uuid and order_id=${orderId}::uuid`;
  await tx`update orders set inventory_deducted_at=clock_timestamp() where id=${orderId}::uuid`;
}

export async function releaseRefundStock(tx: TransactionSql, shopId: string, orderId: string) {
  const [order] = await tx`select inventory_deducted_at,recipe_snapshot_at from orders where id=${orderId}::uuid and shop_id=${shopId}::uuid for update`;
  if (!order || order.inventory_deducted_at || !order.recipe_snapshot_at) return;
  const held = await tx`select ingredient_id from order_stock_holds where shop_id=${shopId}::uuid and order_id=${orderId}::uuid`;
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${held.map(row => row.ingredient_id)}::uuid[]) order by id for update`;
  await tx`delete from order_stock_holds where shop_id=${shopId}::uuid and order_id=${orderId}::uuid`;
  await tx`insert into order_stock_holds(shop_id,order_id,ingredient_id,quantity_milliunits)
    select ${shopId}::uuid,${orderId}::uuid,r.ingredient_id,sum(r.quantity_milliunits::bigint * (i.qty-coalesce(refunded.qty,0)))
    from order_items i join order_item_recipes r on r.order_item_id=i.id
    left join lateral (select sum((line->>'qty')::int) as qty from refunds f cross join lateral jsonb_array_elements(f.lines) line
      where f.order_id=i.order_id and f.shop_id=${shopId}::uuid and line->>'itemId'=i.id::text) refunded on true
    where i.order_id=${orderId}::uuid group by r.ingredient_id having sum(r.quantity_milliunits::bigint * (i.qty-coalesce(refunded.qty,0)))>0`;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(shopId: string, actorStaffId: string): Promise<InventoryState> {
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, false);
      const rows = await tx<Omit<IngredientRow, "lowStock" | "availableMilliunits">[]>`select i.id::text, i.name, i.unit,
        i.low_stock_milliunits as "lowStockMilliunits", coalesce(sum(m.quantity_milliunits),0)::float8 as "onHandMilliunits",
        (coalesce((select sum(h.quantity_milliunits) from order_stock_holds h where h.shop_id=i.shop_id and h.ingredient_id=i.id),0)
        +coalesce((select sum(h.quantity_milliunits) from promptpay_stock_hold_items h join promptpay_stock_holds hh using(shop_id,request_id)
          where h.shop_id=i.shop_id and h.ingredient_id=i.id and hh.expires_at>now()),0))::float8 as "reservedMilliunits"
        from ingredients i left join inventory_movements m on m.ingredient_id=i.id and m.shop_id=i.shop_id
        where i.shop_id=${shopId}::uuid group by i.id order by i.name,i.id`;
      const ingredients = rows.map((row) => {
        if (!Number.isSafeInteger(row.onHandMilliunits)) { throw new ConflictException("Stock balance exceeds supported range"); }
        const availableMilliunits = row.onHandMilliunits - row.reservedMilliunits;
        if (!Number.isSafeInteger(availableMilliunits)) throw new ConflictException("Stock balance exceeds supported range");
        return { ...row, availableMilliunits, lowStock: availableMilliunits <= row.lowStockMilliunits };
      });
      const targets = await tx<InventoryTarget[]>`select id::text,name,'product' as kind from products where shop_id=${shopId}::uuid
        union all select m.id::text,m.name,'modifier' from modifiers m join modifier_groups g on g.id=m.group_id where g.shop_id=${shopId}::uuid`;
      const movements = await tx<InventoryMovementRow[]>`select id::text,ingredient_id::text as "ingredientId",kind,
        quantity_milliunits::float8 as "quantityMilliunits",reason,actor_staff_id::text as "actorStaffId",order_id::text as "orderId",created_at::text as "createdAt",cost_satang::float8 as "costSatang"
        from inventory_movements where shop_id=${shopId}::uuid order by created_at desc,id desc limit 100`;
      return { ingredients, targets, recipes: await recipes(tx, shopId), movements };
    });
  }

  async stockPolicy(shopId: string, actor: string): Promise<{ mode: 'payment' | 'preparation' }> {
    await requireActor(this.database.connection, shopId, actor, false);
    const [shop] = await this.database.connection<{ mode: 'payment' | 'preparation' }[]>`select stock_consumption as mode from shops where id=${shopId}::uuid`;
    return shop;
  }

  async setStockPolicy(shopId: string, actor: string, mode: 'payment' | 'preparation') {
    if (!['payment','preparation'].includes(mode)) throw new BadRequestException('Invalid stock policy');
    return this.database.connection.begin(async tx => {
      await tx`select id from shops where id=${shopId}::uuid for update`;
      await requireActor(tx, shopId, actor, true);
      await requireShopFeature(tx, shopId, 'inventory-write');
      const [held] = await tx`select order_id from order_stock_holds where shop_id=${shopId}::uuid limit 1`;
      if (held) throw new ConflictException('Prepare or refund outstanding reservations before changing stock policy');
      await tx`insert into audit_log(shop_id,actor,action,payload) select ${shopId}::uuid,${actor},'inventory.stock_policy',jsonb_build_object('from',stock_consumption,'to',${mode}::text) from shops where id=${shopId}::uuid`;
      await tx`update shops set stock_consumption=${mode} where id=${shopId}::uuid`;
      return { mode };
    });
  }

  async remake(shopId: string, actor: string, orderId: string, itemId: string, input: { requestId: string; qty: number; reason: string }): Promise<{ id: string }> {
    ids(shopId, actor, orderId, itemId, input.requestId);
    quantity(input.qty);
    if (input.qty > 99 || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) throw new BadRequestException('Remake quantity and reason required');
    const reason = input.reason.trim();
    return this.database.connection.begin(async tx => {
      await tx`select id from shops where id=${shopId}::uuid for share`;
      await requireActor(tx, shopId, actor, false);
      const [order] = await tx`select inventory_deducted_at,recipe_snapshot_at,status from orders where shop_id=${shopId}::uuid and id=${orderId}::uuid for update`;
      if (!order) throw new NotFoundException('Order not found');
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:remake:${input.requestId}`},0))`;
      const [existing] = await tx`select * from remakes where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.order_id !== orderId || existing.order_item_id !== itemId || existing.actor_staff_id !== actor || existing.qty !== input.qty || existing.reason !== reason) throw new ConflictException('Remake request already used');
        return { id: existing.id as string };
      }
      if (!order.inventory_deducted_at || !order.recipe_snapshot_at || order.status !== 'paid') throw new ConflictException('Only prepared bills with recipe snapshots can be remade');
      const [item] = await tx`select i.qty-coalesce((select sum((line->>'qty')::int) from refunds r
        cross join lateral jsonb_array_elements(r.lines) line where r.order_id=i.order_id and r.shop_id=${shopId}::uuid and line->>'itemId'=i.id::text),0) as qty
        from order_items i where i.id=${itemId}::uuid and i.order_id=${orderId}::uuid`;
      if (!item || input.qty > Number(item.qty)) throw new BadRequestException('Cannot remake refunded quantities');
      const [made] = await tx`select coalesce(sum(qty),0)::int as qty from remakes where order_item_id=${itemId}::uuid and shop_id=${shopId}::uuid`;
      if (made.qty + input.qty > Number(item.qty)) await requireActor(tx, shopId, actor, true);
      const recipes = await tx`select ingredient_id,quantity_milliunits from order_item_recipes where order_item_id=${itemId}::uuid`;
      const amounts = new Map<string, number>(recipes.map(row => [row.ingredient_id, row.quantity_milliunits * input.qty]));
      await availableStock(tx, shopId, amounts);
      const [remake] = await tx<{ id: string }[]>`insert into remakes(shop_id,order_id,order_item_id,request_id,qty,reason,actor_staff_id)
        values(${shopId}::uuid,${orderId}::uuid,${itemId}::uuid,${input.requestId}::uuid,${input.qty},${reason},${actor}::uuid) returning id::text`;
      for (const [ingredientId, amount] of amounts) {
        await tx`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,order_id,remake_id)
          values(${shopId}::uuid,${ingredientId}::uuid,'remake',${-amount},${actor}::uuid,${reason},${orderId}::uuid,${remake.id}::uuid)`;
        await tx`update inventory_movements set cost_satang=(select round(average_cost_per_milliunit*${amount}) from ingredients where id=${ingredientId}::uuid) where remake_id=${remake.id}::uuid and ingredient_id=${ingredientId}::uuid`;
      }
      return remake;
    });
  }

  async valueStock(shopId: string, actor: string, ingredientId: string, input: { requestId: string; onHandMilliunits: number; costSatang: number; reason: string }): Promise<{ id: string }> {
    ids(shopId, actor, ingredientId, input.requestId);
    if (!Number.isSafeInteger(input.onHandMilliunits) || input.onHandMilliunits <= 0 || !Number.isSafeInteger(input.costSatang)
      || input.costSatang < 0 || input.costSatang > 2147483647 || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) throw new BadRequestException('Stock quantity, valuation and reason required');
    const payload = { ...input, reason: input.reason.trim(), ingredientId };
    return this.database.connection.begin(async tx => {
      await requireActor(tx, shopId, actor, true);
      await requireShopFeature(tx, shopId, 'inventory-write');
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:valuation:${input.requestId}`},0))`;
      const [existing] = await tx`select id::text,actor,payload from audit_log where shop_id=${shopId}::uuid and action='inventory.valuation' and payload->>'requestId'=${input.requestId}`;
      if (existing) {
        if (existing.actor !== actor || Object.entries(payload).some(([key,value]) => existing.payload[key] !== value)) throw new ConflictException('Valuation request already used');
        return { id: existing.id as string };
      }
      const [ingredient] = await tx`select id,average_cost_per_milliunit from ingredients where shop_id=${shopId}::uuid and id=${ingredientId}::uuid for update`;
      if (!ingredient) throw new NotFoundException('Ingredient not found');
      const [balance] = await tx`select coalesce(sum(quantity_milliunits),0)::float8 as qty from inventory_movements where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid`;
      if (balance.qty !== input.onHandMilliunits) throw new ConflictException('Stock changed; refresh before valuing inventory');
      await tx`update ingredients set average_cost_per_milliunit=${input.costSatang}::numeric/${input.onHandMilliunits} where id=${ingredientId}::uuid`;
      const [audit] = await tx<{ id: string }[]>`insert into audit_log(shop_id,actor,action,payload)
        values(${shopId}::uuid,${actor},'inventory.valuation',${tx.json({ ...payload, previousAverage: ingredient.average_cost_per_milliunit })}) returning id::text`;
      return audit;
    });
  }

  async createIngredient(shopId: string, actorStaffId: string, input: IngredientInput): Promise<{ id: string }> {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 || !["g", "ml", "unit"].includes(input.unit)) {
      throw new BadRequestException("Invalid ingredient");
    }
    quantity(input.lowStockMilliunits, true);
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, true);
      await requireShopFeature(tx, shopId, "inventory-write");
      const [row] = await tx<{ id: string }[]>`insert into ingredients(shop_id,name,unit,low_stock_milliunits)
        values (${shopId}::uuid,${input.name.trim()},${input.unit},${input.lowStockMilliunits})
        on conflict (shop_id,name) do nothing returning id::text`;
      if (!row) { throw new ConflictException("Ingredient name already exists"); }
      return row;
    });
  }

  async setThreshold(shopId: string, actorStaffId: string, ingredientId: string, lowStockMilliunits: number): Promise<{ id: string }> {
    ids(ingredientId);
    quantity(lowStockMilliunits, true);
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, true);
      await requireShopFeature(tx, shopId, "inventory-write");
      const [row] = await tx<{ id: string }[]>`update ingredients set low_stock_milliunits=${lowStockMilliunits}
        where shop_id=${shopId}::uuid and id=${ingredientId}::uuid returning id::text`;
      if (!row) { throw new NotFoundException("Ingredient not found"); }
      return row;
    });
  }

  async setRecipe(shopId: string, actorStaffId: string, kind: "product" | "modifier", targetId: string, lines: RecipeInput[]): Promise<{ ok: true }> {
    ids(shopId, targetId);
    if (!["product", "modifier"].includes(kind) || !Array.isArray(lines) || lines.length > 100
      || new Set(lines.map((line) => line.ingredientId)).size !== lines.length) { throw new BadRequestException("Invalid recipe"); }
    for (const line of lines) {
      ids(line.ingredientId); quantity(line.quantityMilliunits);
      if (line.replacesIngredientId) {
        ids(line.replacesIngredientId);
        if (kind !== 'modifier') throw new BadRequestException('Only modifier recipes replace ingredients');
      }
    }
    return this.database.connection.begin(async (tx) => {
      // Checkout takes SHARE on the same row before it reads recipes.
      await tx`select id from shops where id=${shopId}::uuid for update`;
      await requireActor(tx, shopId, actorStaffId, true);
      await requireShopFeature(tx, shopId, "inventory-write");
      const [activeHold] = await tx`select request_id from promptpay_stock_holds where shop_id=${shopId}::uuid and expires_at>now() limit 1`;
      if (activeHold) { throw new ConflictException({ code: "promptpay_stock_reservation_active" }); }
      const targets = kind === "product"
        ? await tx`select id from products where shop_id=${shopId}::uuid and id=${targetId}::uuid for share`
        : await tx`select m.id from modifiers m join modifier_groups g on g.id=m.group_id where g.shop_id=${shopId}::uuid and m.id=${targetId}::uuid for share of m,g`;
      if (!targets.length) { throw new NotFoundException("Recipe target not found"); }
      const ingredients = await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${lines.map((line) => line.ingredientId)}::uuid[]) order by id for share`;
      if (ingredients.length !== lines.length) { throw new NotFoundException("Recipe ingredient not found"); }
      const replacementIds = [...new Set(lines.flatMap((line) => line.replacesIngredientId ? [line.replacesIngredientId] : []))];
      const replacementIngredients = await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${replacementIds}::uuid[]) for share`;
      if (replacementIngredients.length !== replacementIds.length) throw new NotFoundException('Replacement ingredient not found');
      if (kind === "product") {
        await tx`delete from recipe_lines where shop_id=${shopId}::uuid and product_id=${targetId}::uuid`;
        for (const line of lines) {
          await tx`insert into recipe_lines(shop_id,product_id,ingredient_id,quantity_milliunits)
            values (${shopId}::uuid,${targetId}::uuid,${line.ingredientId}::uuid,${line.quantityMilliunits})`;
        }
      } else {
        await tx`delete from modifier_recipe_lines where shop_id=${shopId}::uuid and modifier_id=${targetId}::uuid`;
        for (const line of lines) {
          await tx`insert into modifier_recipe_lines(shop_id,modifier_id,ingredient_id,quantity_milliunits,replaces_ingredient_id)
            values (${shopId}::uuid,${targetId}::uuid,${line.ingredientId}::uuid,${line.quantityMilliunits},${line.replacesIngredientId ?? null}::uuid)`;
        }
      }
      return { ok: true as const };
    });
  }

  async move(shopId: string, actorStaffId: string, ingredientId: string, input: MovementInput): Promise<{ id: string }> {
    ids(shopId, ingredientId, input.requestId);
    if (!["receive", "waste", "adjust"].includes(input.kind) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 500) {
      throw new BadRequestException("A stock movement requires a reason");
    }
    quantity(input.kind === "adjust" ? Math.abs(input.quantityMilliunits) : input.quantityMilliunits);
    const cost = input.costSatang ?? null;
    if (cost !== null && (input.kind !== 'receive' || !Number.isSafeInteger(cost) || cost < 0 || cost > 2147483647)) throw new BadRequestException('Invalid purchase cost');
    const signed = input.kind === "waste" ? -input.quantityMilliunits : input.quantityMilliunits;
    const reason = input.reason.trim();
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, true);
      if (input.kind !== "receive") { await requireShopFeature(tx, shopId, "inventory-write"); }
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:stock:${input.requestId}`},0))`;
      const [ingredient] = await tx`select id,average_cost_per_milliunit from ingredients where shop_id=${shopId}::uuid and id=${ingredientId}::uuid for update`;
      if (!ingredient) { throw new NotFoundException("Ingredient not found"); }
      const [existing] = await tx`select id::text,ingredient_id,actor_staff_id,kind,quantity_milliunits::float8 as quantity,reason,cost_satang::float8 as cost
        from inventory_movements where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.ingredient_id !== ingredientId || existing.actor_staff_id !== actorStaffId || existing.kind !== input.kind
          || existing.quantity !== signed || existing.reason !== reason || (input.kind === 'receive' && existing.cost !== cost)) { throw new ConflictException("Stock request already used"); }
        return { id: existing.id as string };
      }
      if (signed < 0) {
        const [balance] = await tx<{ onHand: number; held: number }[]>`select
            (coalesce((select sum(quantity_milliunits) from inventory_movements where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid),0) - coalesce((select sum(quantity_milliunits) from order_stock_holds where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid),0))::float8 as "onHand",
            coalesce((select sum(h.quantity_milliunits) from promptpay_stock_hold_items h
              join promptpay_stock_holds hh on hh.shop_id=h.shop_id and hh.request_id=h.request_id
              where h.shop_id=${shopId}::uuid and h.ingredient_id=${ingredientId}::uuid and hh.expires_at>now()),0)::float8 as held`;
        if (!Number.isSafeInteger(balance.onHand) || !Number.isSafeInteger(balance.held) || balance.onHand - balance.held < -signed) {
          throw new ConflictException({ code: "insufficient_inventory_stock" });
        }
      }
      if (input.kind === 'receive' && cost === null && ingredient.average_cost_per_milliunit !== null) throw new BadRequestException('Purchase cost required for valued inventory');
      if (input.kind === 'receive') {
        await tx`update ingredients set average_cost_per_milliunit=(select case
          when ${cost}::numeric is null then null
          when balance.qty<=0 then ${cost}::numeric/${signed}
          when average_cost_per_milliunit is null then null
          else (average_cost_per_milliunit*balance.qty+${cost}::numeric)/(balance.qty+${signed}) end
          from (select coalesce(sum(quantity_milliunits),0) as qty from inventory_movements
            where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid) balance)
          where id=${ingredientId}::uuid and shop_id=${shopId}::uuid`;
      }
      const [row] = await tx<{ id: string }[]>`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,request_id,cost_satang)
        select ${shopId}::uuid,${ingredientId}::uuid,${input.kind},${signed},${actorStaffId}::uuid,${reason},${input.requestId}::uuid,
          case when ${input.kind}='receive' then ${cost}::numeric else round(average_cost_per_milliunit*${Math.abs(signed)}) end from ingredients where id=${ingredientId}::uuid returning id::text`;
      return row;
    });
  }
}
