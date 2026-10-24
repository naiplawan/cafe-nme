import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import { OrdersService } from "../src/orders.service.js";
import { ReconciliationService } from "../src/reconciliation.service.js";
import { SelfOrdersService } from "../src/self-orders.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

describe("verified Omise self-order payments", { skip: !process.env.TEST_DATABASE_URL }, () => {
  let fixture: PaymentSettingsFixture;
  let service: import("../src/omise-payments.service.js").OmisePaymentsService;
  let drafts: SelfOrdersService;
  let orders: OrdersService;
  let productId: string;
  let posts = 0;
  let dropResponse = false;
  const charges = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();
  const originalFetch = globalThis.fetch;
  const originalKeys = process.env.OMISE_SHOP_SECRET_KEYS;
  const originalLive = process.env.OMISE_LIVE_ENABLED;
  async function draft() {
    const result = await drafts.submit(fixture.shopId, { clientKey: randomUUID(), statusToken: randomBytes(32).toString('hex'), mode: 'pickup', tableLabel: null,
      lines: [{ productId, qty: 1, modifierIds: [] }] });
    await drafts.decide(fixture.shopId, fixture.baristaId, result.id, 'accepted');
    return result.id;
  }
  before(async () => {
    fixture = await createPaymentSettingsFixture(process.env.TEST_DATABASE_URL!);
    const { OmisePaymentsService } = await import("../src/omise-payments.service.js");
    orders = new OrdersService(fixture.database as never);
    drafts = new SelfOrdersService(fixture.database as never);
    service = new OmisePaymentsService(fixture.database as never, orders);
    const [product] = await fixture.database.connection`insert into products(shop_id,name,base_price_satang) values (${fixture.shopId},'Provider latte',6500) returning id`;
    productId = product.id;
    process.env.OMISE_SHOP_SECRET_KEYS = JSON.stringify({ [fixture.shopId]: 'skey_test_fixture' });
    delete process.env.OMISE_LIVE_ENABLED;
    globalThis.fetch = async (url, init) => {
      const target = new URL(String(url));
      assert.equal(target.origin, 'https://api.omise.co');
      assert.equal(new Headers(init?.headers).get('authorization'), `Basic ${Buffer.from('skey_test_fixture:').toString('base64')}`);
      if (target.pathname === '/account') { return Response.json({ object: 'account', id: 'account_test_fixture', livemode: false }); }
      if (target.pathname === '/charges' && init?.method === 'POST') {
        posts += 1;
        const form = new URLSearchParams(String(init.body));
        const id = `chrg_test_fixture${posts}`;
        const charge = { object: 'charge', id, amount: Number(form.get('amount')), currency: form.get('currency')?.toUpperCase(), ref_id: form.get('ref_id'),
          livemode: false, paid: false, status: 'pending', metadata: { shop_id: form.get('metadata[shop_id]'), draft_id: form.get('metadata[draft_id]'), intent_id: form.get('metadata[intent_id]') },
          source: { type: 'promptpay', scannable_code: { image: { download_uri: `https://api.omise.co/charges/${id}/documents/docu_test_fixture/downloads/token` } } } };
        charges.set(id, charge);
        if (dropResponse) { dropResponse = false; throw new Error('simulated response loss'); }
        return Response.json(charge);
      }
      if (target.pathname === '/charges') { return Response.json({ object: 'list', data: [...charges.values()] }); }
      if (target.pathname.startsWith('/charges/')) { const charge = charges.get(target.pathname.split('/')[2]); return Response.json(charge ?? {}, { status: charge ? 200 : 404 }); }
      if (target.pathname.startsWith('/events/')) { const event = events.get(target.pathname.split('/')[2]); return Response.json(event ?? {}, { status: event ? 200 : 404 }); }
      throw new Error('Unexpected provider path');
    };
  });
  after(async () => {
    globalThis.fetch = originalFetch;
    if (originalKeys === undefined) { delete process.env.OMISE_SHOP_SECRET_KEYS; } else { process.env.OMISE_SHOP_SECRET_KEYS = originalKeys; }
    if (originalLive === undefined) { delete process.env.OMISE_LIVE_ENABLED; } else { process.env.OMISE_LIVE_ENABLED = originalLive; }
    await fixture?.dispose();
  });

  it("persists an intent, supplies provider QR, and blocks manual double settlement", async () => {
    const id = await draft();
    const result = await service.create(fixture.shopId, fixture.baristaId, id);
    assert.equal(result.status, 'pending'); assert.equal(result.testMode, true); assert.ok(result.qrImageUrl);
    const input = await drafts.getAcceptedDraft(fixture.shopId, fixture.baristaId, id);
    await assert.rejects(orders.checkout(fixture.shopId, fixture.baristaId, { requestId: randomUUID(), selfOrderId: id,
      lines: input.lines, expectedTotalSatang: input.totalSatang, payment: { method: 'cash', cashReceivedSatang: 6500 } }), ConflictException);
    const count = posts;
    assert.equal((await service.create(fixture.shopId, fixture.baristaId, id)).id, result.id);
    assert.equal(posts, count);
  });

  it("ignores forged bodies and only settles verified successful charge once under concurrent events", async () => {
    const id = await draft();
    const intent = await service.create(fixture.shopId, fixture.baristaId, id);
    const charge = [...charges.values()].find((row) => (row.metadata as Record<string, unknown>).intent_id === intent.id)!;
    await service.webhook(fixture.shopId, 'evnt_test_forged');
    assert.equal((await service.get(fixture.shopId, fixture.baristaId, id)).status, 'pending');
    charge.status = 'successful'; charge.paid = true;
    events.set('evnt_test_success', { object: 'event', id: 'evnt_test_success', livemode: false, key: 'charge.complete', data: { id: charge.id } });
    await Promise.all([service.webhook(fixture.shopId, 'evnt_test_success'), service.webhook(fixture.shopId, 'evnt_test_success')]);
    const state = await service.get(fixture.shopId, fixture.baristaId, id);
    assert.equal(state.status, 'completed'); assert.ok(state.orderId);
    const [count] = await fixture.database.connection`select count(*)::int as n from orders where checkout_key=${intent.id}`;
    assert.equal(count.n, 1);
    const rows = await new ReconciliationService(fixture.database as never).list(fixture.shopId, fixture.ownerId, '2026-10-24');
    const providerRow = rows.find((row) => row.paymentId && row.source === 'provider');
    assert.equal(providerRow?.status, 'matched'); assert.equal(providerRow?.recordedBy, 'Omise');
  });

  it("recovers a lost create response without issuing another charge", async () => {
    const id = await draft(); dropResponse = true;
    const intent = await service.create(fixture.shopId, fixture.baristaId, id);
    assert.equal(intent.status, 'uncertain');
    const count = posts;
    const recovered = await service.refresh(fixture.shopId, fixture.baristaId, id);
    assert.equal(recovered.status, 'pending'); assert.equal(posts, count);
  });

  it("persists amount mismatch and paid-but-unfulfilled states without claiming a paid order", async () => {
    const id = await draft(); const intent = await service.create(fixture.shopId, fixture.baristaId, id);
    const charge = [...charges.values()].find((row) => (row.metadata as Record<string, unknown>).intent_id === intent.id)!;
    charge.status = 'successful'; charge.paid = true; charge.amount = 1;
    assert.equal((await service.refresh(fixture.shopId, fixture.baristaId, id)).status, 'discrepancy');
    assert.equal((await service.get(fixture.shopId, fixture.baristaId, id)).orderId, null);
    charge.amount = 6500;
    await fixture.database.connection`update products set base_price_satang=7000 where id=${productId}`;
    assert.equal((await service.refresh(fixture.shopId, fixture.baristaId, id)).status, 'paid_unfulfilled');
    await fixture.database.connection`update products set base_price_satang=6500 where id=${productId}`;
    assert.equal((await service.refresh(fixture.shopId, fixture.baristaId, id)).status, 'completed');
  });
});
