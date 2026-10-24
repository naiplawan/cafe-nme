import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Sql, TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";
import { requireShopFeature } from "./subscriptions.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Connection = Sql | TransactionSql;
export type InventoryUnit = "g" | "ml" | "unit";
export interface IngredientInput { name: string; unit: InventoryUnit; lowStockMilliunits: number }
export interface RecipeInput { ingredientId: string; quantityMilliunits: number }
export interface MovementInput { requestId: string; kind: "receive" | "waste" | "adjust"; quantityMilliunits: number; reason: string }
export interface IngredientRow { id: string; name: string; unit: InventoryUnit; lowStockMilliunits: number; onHandMilliunits: number; lowStock: boolean }
export interface RecipeRow extends RecipeInput { targetKind: "product" | "modifier"; targetId: string }
export interface InventoryMovementRow { id: string; ingredientId: string; kind: "receive" | "waste" | "adjust" | "sale"; quantityMilliunits: number; reason: string; actorStaffId: string | null; orderId: string | null; createdAt: string }
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
  return sql<RecipeRow[]>`select 'product' as "targetKind", r.product_id::text as "targetId", r.ingredient_id::text as "ingredientId", r.quantity_milliunits as "quantityMilliunits"
    from recipe_lines r join ingredients i on i.id=r.ingredient_id and i.shop_id=r.shop_id
    join products p on p.id=r.product_id and p.shop_id=r.shop_id where r.shop_id=${shopId}::uuid
    union all
    select 'modifier',r.modifier_id::text,r.ingredient_id::text,r.quantity_milliunits
    from modifier_recipe_lines r join ingredients i on i.id=r.ingredient_id and i.shop_id=r.shop_id
    join modifiers m on m.id=r.modifier_id join modifier_groups g on g.id=m.group_id and g.shop_id=r.shop_id
    where r.shop_id=${shopId}::uuid`;
}

/** Call in the checkout transaction. Recipes apply once and cannot spend stock below zero. */
export async function deductRecipeStock(tx: TransactionSql, shopId: string, orderId: string,
  lines: { productId: string; qty: number; modifierIds: string[] }[]): Promise<void> {
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
  const amounts = new Map<string, number>();
  for (const line of lines) {
    for (const recipe of configured) {
      if ((recipe.targetKind === "product" && recipe.targetId === line.productId)
        || (recipe.targetKind === "modifier" && line.modifierIds.includes(recipe.targetId))) {
        const amount = (amounts.get(recipe.ingredientId) ?? 0) + recipe.quantityMilliunits * line.qty;
        if (!Number.isSafeInteger(amount)) { throw new BadRequestException("Recipe quantity exceeds supported range"); }
        amounts.set(recipe.ingredientId, amount);
      }
    }
  }
  const ingredientIds = [...amounts.keys()].sort();
  await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${ingredientIds}::uuid[]) order by id for update`;
  const balances = await tx<{ id: string; onHand: number }[]>`select i.id::text as id,
      coalesce(sum(m.quantity_milliunits),0)::float8 as "onHand"
    from ingredients i left join inventory_movements m on m.ingredient_id=i.id and m.shop_id=i.shop_id
    where i.shop_id=${shopId}::uuid and i.id=any(${ingredientIds}::uuid[]) group by i.id order by i.id`;
  const onHandById = new Map(balances.map((row) => [row.id, row.onHand]));
  for (const ingredientId of ingredientIds) {
    const onHand = onHandById.get(ingredientId) ?? 0;
    const required = amounts.get(ingredientId)!;
    if (!Number.isSafeInteger(onHand) || onHand < required) {
      throw new ConflictException({ code: "insufficient_recipe_stock", ingredientId });
    }
    await tx`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,order_id)
      values (${shopId}::uuid,${ingredientId}::uuid,'sale',${-required},${order.staff_id}::uuid,'Recipe consumption',${orderId}::uuid)
      on conflict (order_id,ingredient_id) where kind='sale' do nothing`;
  }
  await tx`update orders set inventory_deducted_at=clock_timestamp() where id=${orderId}::uuid`;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(shopId: string, actorStaffId: string): Promise<InventoryState> {
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, false);
      const rows = await tx<Omit<IngredientRow, "lowStock">[]>`select i.id::text, i.name, i.unit,
        i.low_stock_milliunits as "lowStockMilliunits", coalesce(sum(m.quantity_milliunits),0)::float8 as "onHandMilliunits"
        from ingredients i left join inventory_movements m on m.ingredient_id=i.id and m.shop_id=i.shop_id
        where i.shop_id=${shopId}::uuid group by i.id order by i.name,i.id`;
      const ingredients = rows.map((row) => {
        if (!Number.isSafeInteger(row.onHandMilliunits)) { throw new ConflictException("Stock balance exceeds supported range"); }
        return { ...row, lowStock: row.onHandMilliunits <= row.lowStockMilliunits };
      });
      const targets = await tx<InventoryTarget[]>`select id::text,name,'product' as kind from products where shop_id=${shopId}::uuid
        union all select m.id::text,m.name,'modifier' from modifiers m join modifier_groups g on g.id=m.group_id where g.shop_id=${shopId}::uuid`;
      const movements = await tx<InventoryMovementRow[]>`select id::text,ingredient_id::text as "ingredientId",kind,
        quantity_milliunits::float8 as "quantityMilliunits",reason,actor_staff_id::text as "actorStaffId",order_id::text as "orderId",created_at::text as "createdAt"
        from inventory_movements where shop_id=${shopId}::uuid order by created_at desc,id desc limit 100`;
      return { ingredients, targets, recipes: await recipes(tx, shopId), movements };
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
    for (const line of lines) { ids(line.ingredientId); quantity(line.quantityMilliunits); }
    return this.database.connection.begin(async (tx) => {
      // Checkout takes SHARE on the same row before it reads recipes.
      await tx`select id from shops where id=${shopId}::uuid for update`;
      await requireActor(tx, shopId, actorStaffId, true);
      await requireShopFeature(tx, shopId, "inventory-write");
      const targets = kind === "product"
        ? await tx`select id from products where shop_id=${shopId}::uuid and id=${targetId}::uuid for share`
        : await tx`select m.id from modifiers m join modifier_groups g on g.id=m.group_id where g.shop_id=${shopId}::uuid and m.id=${targetId}::uuid for share of m,g`;
      if (!targets.length) { throw new NotFoundException("Recipe target not found"); }
      const ingredients = await tx`select id from ingredients where shop_id=${shopId}::uuid and id=any(${lines.map((line) => line.ingredientId)}::uuid[]) order by id for share`;
      if (ingredients.length !== lines.length) { throw new NotFoundException("Recipe ingredient not found"); }
      if (kind === "product") {
        await tx`delete from recipe_lines where shop_id=${shopId}::uuid and product_id=${targetId}::uuid`;
        for (const line of lines) {
          await tx`insert into recipe_lines(shop_id,product_id,ingredient_id,quantity_milliunits)
            values (${shopId}::uuid,${targetId}::uuid,${line.ingredientId}::uuid,${line.quantityMilliunits})`;
        }
      } else {
        await tx`delete from modifier_recipe_lines where shop_id=${shopId}::uuid and modifier_id=${targetId}::uuid`;
        for (const line of lines) {
          await tx`insert into modifier_recipe_lines(shop_id,modifier_id,ingredient_id,quantity_milliunits)
            values (${shopId}::uuid,${targetId}::uuid,${line.ingredientId}::uuid,${line.quantityMilliunits})`;
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
    const signed = input.kind === "waste" ? -input.quantityMilliunits : input.quantityMilliunits;
    const reason = input.reason.trim();
    return this.database.connection.begin(async (tx) => {
      await requireActor(tx, shopId, actorStaffId, true);
      if (input.kind !== "receive") { await requireShopFeature(tx, shopId, "inventory-write"); }
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${shopId}:stock:${input.requestId}`},0))`;
      const [ingredient] = await tx`select id from ingredients where shop_id=${shopId}::uuid and id=${ingredientId}::uuid for update`;
      if (!ingredient) { throw new NotFoundException("Ingredient not found"); }
      const [existing] = await tx`select id::text,ingredient_id,actor_staff_id,kind,quantity_milliunits::float8 as quantity,reason
        from inventory_movements where shop_id=${shopId}::uuid and request_id=${input.requestId}::uuid`;
      if (existing) {
        if (existing.ingredient_id !== ingredientId || existing.actor_staff_id !== actorStaffId || existing.kind !== input.kind
          || existing.quantity !== signed || existing.reason !== reason) { throw new ConflictException("Stock request already used"); }
        return { id: existing.id as string };
      }
      if (signed < 0) {
        const [balance] = await tx<{ onHand: number }[]>`select coalesce(sum(quantity_milliunits),0)::float8 as "onHand"
          from inventory_movements where shop_id=${shopId}::uuid and ingredient_id=${ingredientId}::uuid`;
        if (!Number.isSafeInteger(balance.onHand) || balance.onHand < -signed) {
          throw new ConflictException({ code: "insufficient_inventory_stock" });
        }
      }
      const [row] = await tx<{ id: string }[]>`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,request_id)
        values (${shopId}::uuid,${ingredientId}::uuid,${input.kind},${signed},${actorStaffId}::uuid,${reason},${input.requestId}::uuid) returning id::text`;
      return row;
    });
  }
}
