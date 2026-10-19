import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { OrdersController } from "../src/orders.controller.js";

const shopId = randomUUID();
const staffId = randomUUID();
const productId = randomUUID();

function body(overrides: Record<string, unknown> = {}) {
  return {
    staffId,
    lines: [{ productId, qty: 1, modifierIds: [] }],
    payment: { method: "promptpay" },
    ...overrides,
  } as never;
}

test("checkout rejects a provided request key that is not a UUID", () => {
  const controller = new OrdersController({ checkout: async () => ({}) } as never, {} as never);

  assert.throws(
    () => controller.checkout(shopId, body({ requestId: "retry-key" })),
    (error: unknown) => error instanceof BadRequestException && error.message === "invalid checkout payload",
  );
});

test("checkout rejects an unsupported nested line field when called without ValidationPipe", () => {
  const controller = new OrdersController({ checkout: async () => ({}) } as never, {} as never);

  assert.throws(
    () => controller.checkout(shopId, body({ lines: [{ productId, qty: 1, modifierIds: [], unitPriceSatang: 1 }] })),
    (error: unknown) => error instanceof BadRequestException && error.message === "invalid checkout payload",
  );
});

test("checkout rejects unsupported top-level and payment fields when called without ValidationPipe", () => {
  const controller = new OrdersController({ checkout: async () => ({}) } as never, {} as never);

  for (const candidate of [
    body({ unexpected: true }),
    body({ payment: { method: "promptpay", amountSatang: 1 } }),
  ]) {
    assert.throws(
      () => controller.checkout(shopId, candidate),
      (error: unknown) => error instanceof BadRequestException && error.message === "invalid checkout payload",
    );
  }
});

test("checkout accepts an omitted request key for legacy clients", async () => {
  let received: unknown;
  const controller = new OrdersController({
    checkout: async (_shopId: string, _staffId: string, input: unknown) => {
      received = input;
      return { ok: true };
    },
  } as never, {} as never);

  await controller.checkout(shopId, body());
  assert.equal((received as { requestId?: string }).requestId, undefined);
});

test("checkout forwards a valid request key to the service", async () => {
  const requestId = randomUUID();
  let received: unknown;
  const controller = new OrdersController({
    checkout: async (_shopId: string, _staffId: string, input: unknown) => {
      received = input;
      return { ok: true };
    },
  } as never, {} as never);

  await controller.checkout(shopId, body({ requestId }));
  assert.equal((received as { requestId?: string }).requestId, requestId);
});

test("order detail reads are delegated with the shop scope", async () => {
  const orderId = randomUUID();
  const expected = { id: orderId, shopId };
  let received: unknown[] = [];
  const controller = new OrdersController(
    { checkout: async () => ({}) } as never,
    {
      getOrder: async (...args: unknown[]) => {
        received = args;
        return expected;
      },
    } as never,
  );

  assert.deepEqual(await controller.get(shopId, orderId), expected);
  assert.deepEqual(received, [shopId, orderId]);
});
