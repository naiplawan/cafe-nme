import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";

test("alerts deliver only sanitized context, deduplicate and report unavailable delivery honestly", async () => {
  const { createOperationalAlert } = await import("../src/operational-alert.js");
  const received: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) { body += chunk; }
    received.push(JSON.parse(body));
    response.writeHead(204).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const logs: string[] = [];
  const send = createOperationalAlert(() => `http://127.0.0.1:${address.port}`, (message) => logs.push(message));
  try {
    assert.equal(await send({ kind: "api_5xx", statusCode: 500, requestId: "secret-request", shopId: "private-shop" }), "delivered");
    assert.equal(await send({ kind: "api_5xx", statusCode: 500, requestId: "different", shopId: "private-shop" }), "suppressed");
    assert.equal(received.length, 1);
    assert.equal(JSON.stringify(received).includes("secret-request"), false);
    assert.equal(JSON.stringify(received).includes("private-shop"), false);
    assert.equal(await createOperationalAlert(() => undefined, () => {} )({ kind: "checkout_failure" }), "unconfigured");
    assert.equal(await createOperationalAlert(() => "invalid", (message) => logs.push(message))({ kind: "checkout_failure" }), "failed");
    assert.deepEqual(logs, ["Operational alert delivery failed"]);
    for (let i = 0; i < 20; i++) { await send({ kind: "api_5xx", shopId: `shop-${i}` }); }
    assert.equal(received.length, 10);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("failed HTTP delivery and timeout are bounded and never throw the original request away", async () => {
  const { createOperationalAlert } = await import("../src/operational-alert.js");
  const server = createServer((request, response) => {
    if (request.url === "/reject") { response.writeHead(503).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const logs: string[] = [];
  try {
    for (const path of ["/reject", "/hang"]) {
      const send = createOperationalAlert(() => `http://127.0.0.1:${address.port}${path}`, (message) => logs.push(message));
      assert.equal(await send({ kind: "checkout_failure" }), "failed");
    }
    assert.equal(logs.length, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
