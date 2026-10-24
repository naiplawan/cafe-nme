import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("restore drill refuses identical endpoints before touching any database and redacts URLs", () => {
  const result = spawnSync(process.execPath, ["scripts/restore-drill.mjs"], {
    encoding: "utf8", env: { ...process.env, RESTORE_SOURCE_URL: "postgresql://user:secret@localhost/same", RESTORE_TARGET_URL: "postgresql://user:secret@localhost/same" },
  });
  assert.equal(result.status, 1);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.error, "source_target_identical");
  assert.equal((result.stdout + result.stderr).includes("secret"), false);
});

test("local restore preserves rows, constraints and sequence state, and refuses a populated target", { skip: !process.env.OPS_TEST_SERVER_URL }, async () => {
  const { default: postgres } = await import("postgres");
  const { randomUUID } = await import("node:crypto");
  const base = new URL(process.env.OPS_TEST_SERVER_URL!);
  const admin = postgres(base.toString(), { max: 1 });
  const suffix = randomUUID().replaceAll("-", "");
  const sourceUrl = new URL(base);
  const targetUrl = new URL(base);
  sourceUrl.pathname = `/ops_source_${suffix}`;
  targetUrl.pathname = `/ops_target_${suffix}`;
  await admin.unsafe(`CREATE DATABASE "ops_source_${suffix}"`);
  await admin.unsafe(`CREATE DATABASE "ops_target_${suffix}"`);
  const source = postgres(sourceUrl.toString(), { max: 1 });
  const target = postgres(targetUrl.toString(), { max: 1 });
  try {
    await source.unsafe("CREATE TABLE fixture (id serial primary key, amount integer NOT NULL CHECK (amount > 0)); INSERT INTO fixture(amount) VALUES (17),(17),(29)");
    const env = { ...process.env, RESTORE_SOURCE_URL: sourceUrl.toString(), RESTORE_TARGET_URL: targetUrl.toString() };
    const restored = spawnSync(process.execPath, ["scripts/restore-drill.mjs"], { env, encoding: "utf8" });
    assert.equal(restored.status, 0, restored.stdout);
    const evidence = JSON.parse(restored.stdout);
    assert.equal(evidence.ok, true);
    assert.equal(evidence.tables[0].count, "3");
    assert.deepEqual((await target`select amount from fixture order by id`).map((row) => row.amount), [17, 17, 29]);
    assert.equal((await target`insert into fixture(amount) values (43) returning id`)[0].id, 4);
    await assert.rejects(target`insert into fixture(amount) values (-1)`, { code: "23514" });
    const refused = spawnSync(process.execPath, ["scripts/restore-drill.mjs"], { env, encoding: "utf8" });
    assert.equal(refused.status, 1);
    assert.equal(JSON.parse(refused.stdout).error, "target_not_empty");
    assert.equal((await target`select count(*)::int as n from fixture`)[0].n, 4);
  } finally {
    await Promise.all([source.end(), target.end(), admin.end()]);
  }
});
