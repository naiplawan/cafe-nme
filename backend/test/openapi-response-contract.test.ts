import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const document = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema?: unknown }> }> }>>;
};

const operations = [
  ["get", "/health", "200"],
  ["post", "/v1/auth/signup", "201"],
  ["get", "/v1/shops/{shopId}/reports/hourly-sales", "200"],
  ["get", "/v1/auth-users/{authUserId}/shops", "200"],
  ["get", "/v1/shops/{shopId}/payment-settings/promptpay", "200"],
  ["post", "/v1/shops/setup", "201"],
] as const;

test("selected API success responses publish JSON schemas", () => {
  for (const [method, path, status] of operations) {
    const schema = document.paths[path]?.[method]?.responses[status]?.content?.["application/json"]?.schema;
    assert.ok(schema, `${method.toUpperCase()} ${path} ${status} must document its JSON response`);
  }
});

function hasShape(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return false;
  const value = schema as Record<string, unknown>;
  if (typeof value.$ref === "string") return true;
  if (Array.isArray(value.anyOf)) return value.anyOf.every(hasShape);
  if (Array.isArray(value.oneOf)) return value.oneOf.every(hasShape);
  if (Array.isArray(value.allOf)) return value.allOf.every(hasShape);
  if (value.type === "array") return hasShape(value.items);
  if (value.type === "object") {
    const properties = value.properties;
    return Boolean(properties && typeof properties === "object" && Object.keys(properties).length > 0);
  }
  return value.type === "string" || value.type === "number" || value.type === "integer" || value.type === "boolean";
}

test("all successful API responses have concrete schemas", () => {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) < 200 || Number(status) >= 300) continue;
        const schemas = Object.values(response.content ?? {}).map((content) => content.schema);
        assert.ok(schemas.length > 0 && schemas.some(hasShape), `${method.toUpperCase()} ${path} ${status} must have a concrete response schema`);
        for (const schema of schemas) {
          assert.ok(hasShape(schema), `${method.toUpperCase()} ${path} ${status} must not use an empty or generic response schema`);
        }
      }
    }
  }
});
