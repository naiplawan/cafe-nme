import { defineConfig } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/environment";

const env = {
  DATABASE_URL: e2eDatabaseUrl(),
  API_BASE_URL: "http://127.0.0.1:3211",
  API_PORT: "3211",
  FRONTEND_URL: "http://127.0.0.1:3210",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3210",
  RECOVERY_EMAIL_FROM: "E2E <test@example.invalid>",
  APP_SECRET: "e2e-only-app-secret-at-least-thirty-two-bytes",
  INTERNAL_API_SECRET: "e2e-only-internal-secret-at-least-thirty-two-bytes",
  LINE_DEV_MOCK: "0",
  OMISE_SHOP_SECRET_KEYS: "{}",
  OMISE_LIVE_ENABLED: "false",
  OPERATIONAL_ALERT_WEBHOOK_URL: "",
  RESEND_API_KEY: "",
  NODE_ENV: "production",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:3210",
    viewport: { width: 1280, height: 800 },
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @cafenme/backend db:migrate && pnpm --filter @cafenme/backend build && pnpm --filter @cafenme/backend start",
      url: "http://127.0.0.1:3211/health/ready",
      env,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: "pnpm build && pnpm exec next start --hostname 127.0.0.1 -p 3210",
      url: "http://127.0.0.1:3210/pos/pair",
      env,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
