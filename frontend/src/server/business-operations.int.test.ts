import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, shops, staff } from '@/db/schema';
import { businessDate } from '@/lib/business-date';
import { createIngredient, getStockPolicy, listInventory, moveInventory, saveRecipe, setStockPolicy, valueStock } from './inventory';
import { checkout } from './orders';
import { closeShift, getCashStatement, listShifts, openShift } from './shifts';
import { transitionPreparation } from './preparation';
import { marginByItem } from './reports';

let shopId: string;
let owner: string;
let barista: string;
beforeAll(async () => {
  const [shop] = await db.insert(shops).values({ name: 'Business HTTP test', slug: `business-http-${randomUUID()}` }).returning();
  shopId = shop.id;
  const [manager] = await db.insert(staff).values({ shopId, name: 'Manager', role: 'owner' }).returning();
  owner = manager.id;
  const [worker] = await db.insert(staff).values({ shopId, name: 'Barista', role: 'barista' }).returning();
  barista = worker.id;
});
afterAll(async () => { if (shopId) await db.delete(shops).where(eq(shops.id, shopId)); });

it('values legacy stock through the HTTP contract without allowing a stale or unauthorized valuation', async () => {
  const ingredient = await createIngredient(shopId, owner, { name: 'Milk', unit: 'ml', lowStockMilliunits: 0 });
  await moveInventory(shopId, owner, ingredient.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000000, reason: 'Opening stock' });
  const input = { requestId: randomUUID(), onHandMilliunits: 1000000, costSatang: 5000, reason: 'Opening invoice' };
  const first = await valueStock(shopId, owner, ingredient.id, input);
  expect(await valueStock(shopId, owner, ingredient.id, input)).toEqual(first);
  await expect(valueStock(shopId, barista, ingredient.id, { ...input, requestId: randomUUID() })).rejects.toMatchObject({ status: 403 });
  await expect(valueStock(shopId, owner, ingredient.id, { ...input, requestId: randomUUID(), onHandMilliunits: 900000 })).rejects.toMatchObject({ status: 409 });
  await expect(moveInventory(shopId, owner, ingredient.id, { requestId: randomUUID(), kind: 'receive', quantityMilliunits: 1000, reason: 'Missing cost' })).rejects.toMatchObject({ status: 400 });
  const [product] = await db.insert(products).values({ shopId, name: 'Valued coffee', basePriceSatang: 7000 }).returning();
  await saveRecipe(shopId, owner, 'product', product.id, [{ ingredientId: ingredient.id, quantityMilliunits: 200000 }]);
  expect(await getStockPolicy(shopId, owner)).toEqual({ mode: 'payment' });
  await setStockPolicy(shopId, owner, 'preparation');
  await openShift(shopId, owner, { requestId: randomUUID(), openingFloatSatang: 0 });
  const sale = await checkout({ shopId, staffId: owner }, { requestId: randomUUID(), lines: [{ productId: product.id, qty: 1, modifierIds: [] }], payment: { method: 'cash', cashReceivedSatang: 7000 } });
  const today = businessDate(new Date());
  expect((await marginByItem(shopId, today, today)).items[0]).toMatchObject({ pendingQty: 1, marginSatang: null });
  expect((await listInventory(shopId, owner)).ingredients[0]).toMatchObject({ onHandMilliunits: 1000000, reservedMilliunits: 200000, availableMilliunits: 800000 });
  await expect(setStockPolicy(shopId, owner, 'payment')).rejects.toMatchObject({ status: 409 });
  await transitionPreparation(shopId, barista, sale.orderId, 'received', 'preparing');
  expect((await marginByItem(shopId, today, today)).items[0]).toMatchObject({ pendingQty: 0, knownCostSatang: 1000, marginSatang: 6000 });
});

it('reads a closed cash statement through the HTTP contract without changing its snapshot', async () => {
  const state = await listShifts(shopId, owner);
  const active = state.shifts.find(shift => !shift.closedAt)!;
  await closeShift(shopId, owner, active.id, { requestId: randomUUID(), countedCashSatang: 7000 });
  const statement = await getCashStatement(shopId, barista, active.id);
  expect(statement).toMatchObject({ ledgerCashSatang: 7000, snapshotDifferenceSatang: 0, entryCount: 1, page: 1, pageSize: 100 });
  expect(statement?.entries[0]).toMatchObject({ kind: 'sale', amountSatang: 7000, actorName: 'Manager' });
  expect(await getCashStatement(shopId, owner, randomUUID())).toBeNull();
});
