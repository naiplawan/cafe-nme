import assert from "node:assert/strict";
import test from "node:test";
import { Logger, type ArgumentsHost } from "@nestjs/common";
import { HttpExceptionFilter } from "../src/http-exception.filter.js";

test("server errors log request context and stack frames without returning exception details", () => {
  const messages: string[] = [];
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const originalError = Logger.prototype.error;
  Logger.prototype.error = (message: unknown) => {
    messages.push(String(message));
  };

  try {
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ header: () => "request-123", method: "POST", path: "/v1/shops/shop/orders" }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch(new Error("private database detail"), host);
  } finally {
    Logger.prototype.error = originalError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    statusCode: 500,
    message: "Internal server error",
    error: "Internal Server Error",
  });
  assert.equal(messages.length, 1);
  const log = JSON.parse(messages[0]) as Record<string, unknown>;
  assert.equal(log.requestId, "request-123");
  assert.equal(log.method, "POST");
  assert.equal(log.path, "/v1/shops/shop/orders");
  assert.equal(log.errorName, "Error");
  assert.match(String(log.stack), /http-exception-filter\.test\.ts/);
  assert.equal(JSON.stringify(log).includes("private database detail"), false);
});

test("5xx sends a sanitized webhook while keeping the HTTP error response intact", async () => {
  const { createServer } = await import("node:http");
  const messages: unknown[] = [];
  let notify: () => void = () => {};
  const received = new Promise<void>((resolve) => { notify = resolve; });
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) { body += chunk; }
    messages.push(JSON.parse(body));
    response.writeHead(204).end();
    notify();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const previous = process.env.OPERATIONAL_ALERT_WEBHOOK_URL;
  process.env.OPERATIONAL_ALERT_WEBHOOK_URL = `http://127.0.0.1:${address.port}`;
  const response = { status: (_status: number) => response, json: (_body: unknown) => response };
  const host = { switchToHttp: () => ({
    getRequest: () => ({ header: () => "request-alert", method: "POST", path: "/private/path", params: { shopId: "private-shop" } }),
    getResponse: () => response,
  }) } as unknown as ArgumentsHost;
  try {
    new HttpExceptionFilter().catch(new Error("secret failure"), host);
    await Promise.race([received, new Promise((_, reject) => setTimeout(() => reject(new Error("alert missing")), 1500))]);
    const payload = messages[0] as Record<string, unknown>;
    assert.equal(payload.kind, "api_5xx");
    assert.match(String(payload.shopIdHash), /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(payload).includes("private"), false);
    assert.equal(JSON.stringify(payload).includes("secret"), false);
  } finally {
    if (previous === undefined) { delete process.env.OPERATIONAL_ALERT_WEBHOOK_URL; } else { process.env.OPERATIONAL_ALERT_WEBHOOK_URL = previous; }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
