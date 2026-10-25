// Never fall back to DATABASE_URL: it may point at a real shop.
export function e2eDatabaseUrl(): string {
  const value = process.env.E2E_DATABASE_URL;
  if (!value) { throw new Error("Set E2E_DATABASE_URL to a disposable local cafe_pos_e2e database"); }
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1"].includes(url.hostname)
    || url.pathname !== "/cafe_pos_e2e") {
    throw new Error("E2E requires a local database named cafe_pos_e2e");
  }
  return value;
}
