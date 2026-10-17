import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const integration = process.env.INTEGRATION === "1";

export default defineConfig({
  resolve: {
    alias: {
      // Most specific first: Vite uses the first alias whose key prefixes the import.
      "@/db/schema": fileURLToPath(new URL("../backend/src/db/schema.ts", import.meta.url)),
      "@/db": fileURLToPath(new URL("./test/db.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // *.int.test.ts need the configured PostgreSQL database: run them with `pnpm test:int`.
    include: integration ? ["src/**/*.int.test.ts"] : ["src/**/*.test.ts"],
    exclude: integration ? [] : ["src/**/*.int.test.ts"],
    setupFiles: integration ? ["./test/load-env.ts"] : [],
    fileParallelism: !integration,
  },
});
