import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("recipe inventory ledger", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: import("../src/inventory.service.js").InventoryService;
  let deduct: typeof import("../src/inventory.service.js").deductRecipeStock;
  let beans: string;
  let milk: string;
  let product: string;
  let modifier: string;
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    const module = await import("../src/inventory.service.js");
    service = new module.InventoryService(fixture.database as never);
    deduct = module.deductRecipeStock;
    const [row] = await fixture.database.connection`insert into products(shop_id,name,base_price_satang) values (${fixture.shopId},'Latte',6500) returning id`;
    product = row.id;
    const [group] = await fixture.database.connection`insert into modifier_groups(shop_id,name) values (${fixture.shopId},'Extras') returning id`;
    const [extra] = await fixture.database.connection`insert into modifiers(group_id,name) values (${group.id},'Extra shot') returning id`;
    modifier = extra.id;
  });
  after(async () => { await fixture?.dispose(); });

  it("receives and wastes exact milliunits with an idempotent reasoned ledger", async () => {
    beans = (await service.createIngredient(fixture.shopId, fixture.ownerId, { name: 'Beans', unit: 'g', lowStockMilliunits: 50000 })).id;
    milk = (await service.createIngredient(fixture.shopId, fixture.ownerId, { name: 'Milk', unit: 'ml', lowStockMilliunits: 100000 })).id;
    const input = { requestId: randomUUID(), kind: 'receive' as const, quantityMilliunits: 100000, reason: 'Delivery' };
    await service.move(fixture.shopId, fixture.managerId, beans, input);
    await service.move(fixture.shopId, fixture.managerId, beans, input);
    await assert.rejects(service.move(fixture.shopId, fixture.managerId, beans, { ...input, quantityMilliunits: 200000 }), ConflictException);
    await service.move(fixture.shopId, fixture.managerId, milk, { ...input, requestId: randomUUID(), quantityMilliunits: 500000 });
    await service.move(fixture.shopId, fixture.managerId, beans, { requestId: randomUUID(), kind: 'waste', quantityMilliunits: 10000, reason: 'Spill' });
    const state = await service.list(fixture.shopId, fixture.baristaId);
    assert.equal(state.ingredients.find((row) => row.id === beans)?.onHandMilliunits, 90000);
  });

  it("deducts aggregated latte and additive modifier recipes once per order", async () => {
    await service.setRecipe(fixture.shopId, fixture.ownerId, 'product', product, [
      { ingredientId: beans, quantityMilliunits: 18000 }, { ingredientId: milk, quantityMilliunits: 200000 },
    ]);
    await service.setRecipe(fixture.shopId, fixture.ownerId, 'modifier', modifier, [{ ingredientId: beans, quantityMilliunits: 9000 }]);
    await service.move(fixture.shopId, fixture.managerId, milk, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 200000, reason: 'Opening stock' });
    const [order] = await fixture.database.connection`insert into orders(shop_id,daily_no,business_date) values (${fixture.shopId},1,'2026-10-23') returning id`;
    const lines = [{ productId: product, qty: 1, modifierIds: [modifier] }, { productId: product, qty: 2, modifierIds: [] }];
    await Promise.all([
      fixture.database.connection.begin((tx) => deduct(tx, fixture.shopId, order.id, lines)),
      fixture.database.connection.begin((tx) => deduct(tx, fixture.shopId, order.id, lines)),
    ]);
    const state = await service.list(fixture.shopId, fixture.ownerId);
    assert.equal(state.ingredients.find((row) => row.id === beans)?.onHandMilliunits, 27000);
    assert.equal(state.ingredients.find((row) => row.id === milk)?.onHandMilliunits, 100000);
    assert.equal(state.ingredients.find((row) => row.id === milk)?.lowStock, true);
    const [count] = await fixture.database.connection`select count(*)::int as n from inventory_movements where order_id=${order.id}`;
    assert.equal(count.n, 2);
  });

  it("rejects recipe consumption that would make a tracked ingredient negative", async () => {
    const sql = fixture.database.connection;
    const limited = (await service.createIngredient(fixture.shopId, fixture.ownerId, { name: "Limited beans", unit: "g", lowStockMilliunits: 0 })).id;
    await service.move(fixture.shopId, fixture.managerId, limited, { requestId: randomUUID(), kind: "receive", quantityMilliunits: 999, reason: "Opening stock" });
    const [limitedProduct] = await sql`insert into products(shop_id,name,base_price_satang) values(${fixture.shopId},'Limited coffee',100) returning id`;
    await service.setRecipe(fixture.shopId, fixture.ownerId, "product", limitedProduct.id, [{ ingredientId: limited, quantityMilliunits: 1000 }]);

    await assert.rejects(sql.begin(async (tx) => {
      const [order] = await tx`insert into orders(shop_id,daily_no,business_date) values(${fixture.shopId},4,'2026-10-23') returning id`;
      await deduct(tx, fixture.shopId, order.id, [{ productId: limitedProduct.id, qty: 1, modifierIds: [] }]);
    }), ConflictException);
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).ingredients.find((row) => row.id === limited)?.onHandMilliunits, 999);
  });

  it("rejects waste and count adjustments that exceed available stock", async () => {
    const ingredient = (await service.createIngredient(fixture.shopId, fixture.ownerId, { name: "Counted syrup", unit: "ml", lowStockMilliunits: 0 })).id;
    await service.move(fixture.shopId, fixture.managerId, ingredient, { requestId: randomUUID(), kind: "receive", quantityMilliunits: 1000, reason: "Opening stock" });
    await assert.rejects(service.move(fixture.shopId, fixture.managerId, ingredient, { requestId: randomUUID(), kind: "waste", quantityMilliunits: 1001, reason: "Spill" }), ConflictException);
    await assert.rejects(service.move(fixture.shopId, fixture.managerId, ingredient, { requestId: randomUUID(), kind: "adjust", quantityMilliunits: -1001, reason: "Count" }), ConflictException);
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).ingredients.find((row) => row.id === ingredient)?.onHandMilliunits, 1000);
  });

  it("rolls all consumption back with the checkout transaction", async () => {
    await service.move(fixture.shopId, fixture.managerId, milk, { requestId: randomUUID(), kind: "receive", quantityMilliunits: 200000, reason: "Opening stock" });
    const before = await service.list(fixture.shopId, fixture.ownerId);
    await assert.rejects(fixture.database.connection.begin(async (tx) => {
      const [order] = await tx`insert into orders(shop_id,daily_no,business_date) values (${fixture.shopId},2,'2026-10-23') returning id`;
      await deduct(tx, fixture.shopId, order.id, [{ productId: product, qty: 1, modifierIds: [] }]);
      throw new Error('checkout aborted');
    }), /checkout aborted/);
    assert.deepEqual((await service.list(fixture.shopId, fixture.ownerId)).ingredients, before.ingredients);
  });

  it("rejects cross-shop references and unauthorized inventory mutation", async () => {
    await assert.rejects(service.list(fixture.shopId, fixture.otherShopOwnerId), ForbiddenException);
    await assert.rejects(service.move(fixture.shopId, fixture.baristaId, beans, { requestId: randomUUID(), kind: 'adjust', quantityMilliunits: 1000, reason: 'Count' }), ForbiddenException);
    await assert.rejects(service.setRecipe(fixture.shopId, fixture.ownerId, 'product', product, [{ ingredientId: randomUUID(), quantityMilliunits: 1000 }]), NotFoundException);
    await assert.rejects(service.setRecipe(fixture.shopId, fixture.ownerId, 'product', randomUUID(), []), NotFoundException);
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).recipes.filter((row) => row.targetId === product).length, 2);
  });
  it("does not retroactively consume an order that had no recipe", async () => {
    const sql = fixture.database.connection;
    const [plain] = await sql`insert into products(shop_id,name,base_price_satang) values (${fixture.shopId},'Plain',100) returning id`;
    const [order] = await sql`insert into orders(shop_id,daily_no,business_date) values (${fixture.shopId},3,'2026-10-23') returning id`;
    const lines = [{ productId: plain.id, qty: 1, modifierIds: [] }];
    await sql.begin((tx) => deduct(tx, fixture.shopId, order.id, lines));
    await service.setRecipe(fixture.shopId, fixture.ownerId, 'product', plain.id, [{ ingredientId: beans, quantityMilliunits: 1000 }]);
    await sql.begin((tx) => deduct(tx, fixture.shopId, order.id, lines));
    const [count] = await sql`select count(*)::int as n from inventory_movements where order_id=${order.id}`;
    assert.equal(count.n, 0);
    const [marked] = await sql`select inventory_deducted_at from orders where id=${order.id}`;
    assert.ok(marked.inventory_deducted_at);
  });

  it("rejects actual foreign-shop products/ingredients and invalid reason or quantities", async () => {
    const sql = fixture.database.connection;
    const [other] = await sql`select shop_id from staff where id=${fixture.otherShopOwnerId}`;
    const ingredient = await service.createIngredient(other.shop_id, fixture.otherShopOwnerId, { name: 'Foreign', unit: 'unit', lowStockMilliunits: 0 });
    const [foreignProduct] = await sql`insert into products(shop_id,name,base_price_satang) values (${other.shop_id},'Foreign',100) returning id`;
    await assert.rejects(service.setRecipe(fixture.shopId, fixture.ownerId, 'product', foreignProduct.id, []), NotFoundException);
    await assert.rejects(service.setRecipe(fixture.shopId, fixture.ownerId, 'product', product,
      [{ ingredientId: ingredient.id, quantityMilliunits: 1000 }]), NotFoundException);
    await assert.rejects(service.move(fixture.shopId, fixture.ownerId, ingredient.id,
      { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000, reason: 'Delivery' }), NotFoundException);
    for (const input of [
      { quantityMilliunits: 0, reason: 'Count' }, { quantityMilliunits: 0.1, reason: 'Count' }, { quantityMilliunits: 1000, reason: ' ' },
    ]) {
      await assert.rejects(service.move(fixture.shopId, fixture.ownerId, beans,
        { requestId: randomUUID(), kind: 'adjust', ...input }), BadRequestException);
    }
    const before = (await service.list(fixture.shopId, fixture.ownerId)).ingredients.find((row) => row.id === beans)!.onHandMilliunits;
    await service.move(fixture.shopId, fixture.ownerId, beans, { requestId: randomUUID(), kind: 'adjust', quantityMilliunits: -1, reason: 'Stock count correction' });
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).ingredients.find((row) => row.id === beans)?.onHandMilliunits, before - 1);
    await service.setThreshold(fixture.shopId, fixture.ownerId, beans, 1);
    assert.equal((await service.list(fixture.shopId, fixture.ownerId)).ingredients.find((row) => row.id === beans)?.lowStock, false);
  });

});
