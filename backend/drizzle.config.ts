import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../frontend/.env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Supabase owns the auth/storage schemas; only manage public.
  schemaFilter: ["public"],
});
