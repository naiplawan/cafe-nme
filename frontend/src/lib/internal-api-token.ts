import "server-only";
import { createHmac } from "node:crypto";

export function createInternalApiToken(secret = process.env.APP_SECRET): string {
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET must be set (32+ chars)");
  }
  return createHmac("sha256", secret).update("cafe-pos:internal-api-v1").digest("hex");
}
