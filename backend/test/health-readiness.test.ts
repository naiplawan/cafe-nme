import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { HealthController } from "../src/health.controller.js";
import type { DatabaseService } from "../src/database.service.js";

describe("database migration readiness", { skip: !process.env.TEST_DATABASE_URL }, () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
  const admin = postgres(databaseUrl, { max: 1 });
  const name = `readiness_${randomUUID().replaceAll("-", "")}`;
  let connection: ReturnType<typeof postgres>;
  let health: HealthController;

  before(async () => {
    await admin`create database ${admin(name)}`;
    const url = new URL(databaseUrl);
    url.pathname = `/${name}`;
    connection = postgres(url.toString(), { max: 1, onnotice: () => undefined });
    health = new HealthController({ connection } as DatabaseService);
  });

  after(async () => {
    await connection?.end();
    await admin`drop database if exists ${admin(name)}`;
    await admin.end();
  });

  it("keeps liveness independent of migration readiness", () => {
    assert.deepEqual(health.getHealth(), { status: "ok" });
  });

  it("rejects an unmigrated database and accepts the installed migrations", async () => {
    await assert.rejects(health.getReadiness(), ServiceUnavailableException);
    await migrate(drizzle(connection), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    assert.deepEqual(await health.getReadiness(), { status: "ready" });
  });

  it("rejects migration history that does not match the deployed SQL", async () => {
    await migrate(drizzle(connection), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    await connection`update drizzle.__drizzle_migrations set hash = 'incorrect' where id = (select max(id) from drizzle.__drizzle_migrations)`;
    await assert.rejects(health.getReadiness(), ServiceUnavailableException);
  });
});
