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
