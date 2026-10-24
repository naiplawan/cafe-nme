import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const started = Date.now();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
let phase = "configuration";
let directory;
let source;
let target;
const run = (command, args, url) => execFileSync(command, ["--dbname", url, ...args], {
  env: { ...process.env, PGDATABASE: url }, stdio: ["ignore", "pipe", "pipe"], timeout: 300_000,
});
const identity = async (sql) => (await sql`select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`)[0];
const tables = async (sql) => sql`select schemaname, tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by schemaname, tablename`;
async function contents(sql) {
  const result = [];
  for (const table of await tables(sql)) {
    const name = `${identifier(table.schemaname)}.${identifier(table.tablename)}`;
    const rows = await sql.unsafe(`select count(*)::text as count, md5(coalesce(string_agg(digest, '' order by digest), '')) as digest from (select md5(to_jsonb(t)::text) as digest from ${name} t) d`);
    result.push({ table: `${table.schemaname}.${table.tablename}`, ...rows[0] });
  }
  return result;
}
function schemaDigest(url, snapshot) {
  const output = run("pg_dump", ["--schema-only", "--no-owner", "--no-acl", ...(snapshot ? [`--snapshot=${snapshot}`] : [])], url).toString();
  const normalizeGrouping = (line) => {
    if (!line.includes("CHECK (") || !line.includes(" AND ") || line.includes(" OR ")) { return line; }
    const stack = [];
    const groups = new Set();
    let quote = null;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quote) {
        if (char === quote && line[index + 1] === quote) { index += 1; }
        else if (char === quote) { quote = null; }
        continue;
      }
      if (char === "'" || char === '"') { quote = char; continue; }
      if (char === "(") { stack.push(index); }
      else if (char === ")") {
        const start = stack.pop();
        if (start === undefined) { continue; }
        const previous = line[start - 1] ?? " ";
        // Keep function/type-call parentheses; grouping around AND-only predicates is redundant.
        if (!/[\p{L}\p{N}_\]"']$/u.test(previous)) { groups.add(start); groups.add(index); }
      }
    }
    return [...line].filter((_, index) => !groups.has(index)).join("");
  };
  return hash(output.split("\n").filter((line) => !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict") && !line.startsWith("--"))
    .map(normalizeGrouping).join("\n"));
}
try {
  const sourceUrl = process.env.RESTORE_SOURCE_URL;
  const targetUrl = process.env.RESTORE_TARGET_URL;
  if (!sourceUrl || !targetUrl) { throw new Error("urls_required"); }
  const a = new URL(sourceUrl);
  const b = new URL(targetUrl);
  if (a.hostname === b.hostname && (a.port || "5432") === (b.port || "5432") && a.pathname === b.pathname) { throw new Error("source_target_identical"); }
  source = postgres(sourceUrl, { max: 1, connect_timeout: 10 });
  target = postgres(targetUrl, { max: 1, connect_timeout: 10 });
  phase = "target_safety";
  const sourceIdentity = await identity(source);
  const targetIdentity = await identity(target);
  if (JSON.stringify(sourceIdentity) === JSON.stringify(targetIdentity)) { throw new Error("source_target_identical"); }
  const objects = await target`select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'`;
  const schemas = await target`select count(*)::int as count from pg_namespace where nspname not like 'pg_%' and nspname not in ('information_schema','public')`;
  const routines = await target`select count(*)::int as count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'`;
  const types = await target`select count(*)::int as count from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'`;
  if ([objects, schemas, routines, types].some((rows) => rows[0].count > 0)) { throw new Error("target_not_empty"); }
  directory = await mkdtemp(join(tmpdir(), "cafe-restore-"));
  const archive = join(directory, "backup.dump");
  phase = "backup";
  const before = await source.begin("isolation level repeatable read read only", async (sql) => {
    const [{ snapshot }] = await sql`select pg_export_snapshot() as snapshot`;
    run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", `--snapshot=${snapshot}`, "--file", archive], sourceUrl);
    return { schema: schemaDigest(sourceUrl, snapshot), tables: await contents(sql) };
  });
  phase = "restore";
  run("pg_restore", ["--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", archive], targetUrl);
  phase = "verification";
  const after = { schema: schemaDigest(targetUrl), tables: await contents(target) };
  if (JSON.stringify(before) !== JSON.stringify(after)) { throw new Error("verification_mismatch"); }
  process.stdout.write(`${JSON.stringify({ ok: true, sourceId: hash(JSON.stringify(sourceIdentity)), targetId: hash(JSON.stringify(targetIdentity)), archiveSha256: hash(await readFile(archive)), schemaSha256: after.schema, tables: after.tables, elapsedMs: Date.now() - started })}\n`);
} catch (error) {
  const known = ["urls_required", "source_target_identical", "target_not_empty", "verification_mismatch"];
  process.stdout.write(`${JSON.stringify({ ok: false, phase, error: known.includes(error.message) ? error.message : "drill_failed", elapsedMs: Date.now() - started })}\n`);
  process.exitCode = 1;
} finally {
  await source?.end({ timeout: 2 });
  await target?.end({ timeout: 2 });
  if (directory) { await rm(directory, { recursive: true, force: true }); }
}
