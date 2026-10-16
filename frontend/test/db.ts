import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../backend/src/db/schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for integration tests");
}

const globalForDatabase = globalThis as typeof globalThis & { sql?: ReturnType<typeof postgres> };
const sql = globalForDatabase.sql ?? postgres(databaseUrl, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDatabase.sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
