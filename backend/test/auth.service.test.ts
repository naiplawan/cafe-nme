import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseService } from "../src/database.service.js";
import type { RateLimitService } from "../src/rate-limit.service.js";
import { AuthService } from "../src/auth.service.js";

test("signup creates an immediately usable account without email delivery", async () => {
  const statements: string[] = [];
  const query = async (strings: TemplateStringsArray) => {
    const statement = strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    statements.push(statement);
    if (statement.includes("insert into users")) {
      return [{ id: "user-id", email: "owner@example.com" }];
    }
    return [];
  };
  const connection = Object.assign(query, {
    begin: async <T>(callback: (transaction: typeof query) => Promise<T>) => callback(query),
  });
  const service = new AuthService(
    { connection } as unknown as DatabaseService,
    { consume: async () => true } as unknown as RateLimitService,
  );
  const result = await service.signUp("OWNER@example.com", "a-secure-password", "203.0.113.8");

  assert.equal(result.user.email, "owner@example.com");
  assert.equal(result.user.id, "user-id");
  assert.ok(result.token.length > 0);
  assert.ok(statements.some((statement) => statement.includes("insert into users")));
  assert.ok(statements.some((statement) => statement.includes("insert into auth_sessions")));
});
