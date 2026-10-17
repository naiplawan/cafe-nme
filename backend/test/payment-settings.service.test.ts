import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PaymentSettingsService } from "../src/payment-settings.service.js";
import { createPaymentSettingsFixture, type PaymentSettingsFixture } from "./payment-settings-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = databaseUrl
  ? undefined
  : "TEST_DATABASE_URL is not set; skipping PostgreSQL payment settings integration test";

let fixture: PaymentSettingsFixture | undefined;
let settings: PaymentSettingsService | undefined;

before(async () => {
  if (!databaseUrl) {
    return;
  }
  fixture = await createPaymentSettingsFixture(databaseUrl);
  settings = new PaymentSettingsService(fixture.database as never);
});

after(async () => {
  await fixture?.dispose();
});

function service(): PaymentSettingsService {
  if (!settings) {
    throw new Error("Payment settings fixture was not initialized");
  }
  return settings;
}

test("reads, saves normalized PromptPay IDs, and clears them with null", { skip: skipReason }, async () => {
  assert.ok(fixture);

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, null);
  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: null });

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, " 081-234-5678 ");
  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: "0812345678" });

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, null);
  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: null });
});

test("rejects invalid PromptPay input without overwriting the saved identifier", { skip: skipReason }, async () => {
  assert.ok(fixture);

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, "0812345678");
  await assert.rejects(
    service().savePromptPayId(fixture.shopId, fixture.ownerId, "123"),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: "0812345678" });

  await assert.rejects(
    service().savePromptPayId(fixture.shopId, fixture.ownerId, 123),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: "0812345678" });
});

test("rejects managers, baristas, inactive owners, and owners from another shop", { skip: skipReason }, async () => {
  assert.ok(fixture);

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, "0812345678");
  const unauthorizedActors = [
    ["manager", fixture.managerId],
    ["barista", fixture.baristaId],
    ["inactive owner", fixture.inactiveOwnerId],
    ["other shop owner", fixture.otherShopOwnerId],
  ] as const;

  for (const [actorName, actorId] of unauthorizedActors) {
    await assert.rejects(
      service().getPromptPayId(fixture.shopId, actorId),
      (error: unknown) => error instanceof ForbiddenException,
      `${actorName} must not read payment settings`,
    );
    await assert.rejects(
      service().savePromptPayId(fixture.shopId, actorId, null),
      (error: unknown) => error instanceof ForbiddenException,
      `${actorName} must not save payment settings`,
    );
  }

  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: "0812345678" });
});

test("rejects malformed actor IDs before accessing payment settings", { skip: skipReason }, async () => {
  assert.ok(fixture);

  await service().savePromptPayId(fixture.shopId, fixture.ownerId, "0812345678");
  for (const actorId of ["not-a-uuid", "", 123]) {
    await assert.rejects(
      service().getPromptPayId(fixture.shopId, actorId as string),
      (error: unknown) => error instanceof BadRequestException,
      `malformed actor ${String(actorId)} must not read payment settings`,
    );
    await assert.rejects(
      service().savePromptPayId(fixture.shopId, actorId as string, null),
      (error: unknown) => error instanceof BadRequestException,
      `malformed actor ${String(actorId)} must not save payment settings`,
    );
  }

  assert.deepEqual(await service().getPromptPayId(fixture.shopId, fixture.ownerId), { promptpayId: "0812345678" });
});
