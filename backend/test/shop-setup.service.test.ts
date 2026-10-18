import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseService } from "../src/database.service.js";
import { ShopSetupService } from "../src/shop-setup.service.js";

test("allows an existing owner to create an independent branch", async () => {
  const queries: string[] = [];
  const tx = async (strings: TemplateStringsArray) => {
    const query = strings.join(" ").replace(/\s+/g, " ").trim();
    queries.push(query);
    if (query.includes("insert into shops")) return [{ id: "new-shop-id" }];
    if (query.includes("select role from staff")) return [{ role: "owner" }];
    return [];
  };
  const connection = Object.assign(async () => [], {
    begin: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  });
  const service = new ShopSetupService({ connection } as unknown as DatabaseService);

  assert.deepEqual(await service.createShop({
    authUserId: "existing-owner-user",
    shopName: "South Branch",
    slug: "south-branch-123abc",
    ownerName: "Owner",
    promptpayId: null,
    pin: "1234",
  }), { status: "created", shopId: "new-shop-id" });
  assert.ok(queries.some((query) => query.includes("insert into shops")));
  assert.ok(queries.some((query) => query.includes("insert into staff")));
});

test("does not allow a manager to create another shop", async () => {
  const queries: string[] = [];
  const tx = async (strings: TemplateStringsArray) => {
    const query = strings.join(" ").replace(/\s+/g, " ").trim();
    queries.push(query);
    if (query.includes("select role from staff")) return [{ role: "manager" }];
    return [];
  };
  const connection = Object.assign(async () => [], {
    begin: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  });
  const service = new ShopSetupService({ connection } as unknown as DatabaseService);

  await assert.rejects(service.createShop({
    authUserId: "existing-manager-user",
    shopName: "Unauthorized Branch",
    slug: "unauthorized-branch-123abc",
    ownerName: "Manager",
    promptpayId: null,
    pin: "1234",
  }));
  assert.equal(queries.some((query) => query.includes("insert into shops")), false);
});
