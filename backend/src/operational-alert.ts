import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";

export interface OperationalAlert {
  kind: "api_5xx" | "checkout_failure";
  statusCode?: number;
  requestId?: string;
  shopId?: string;
}

export function createOperationalAlert(endpoint: () => string | undefined, logFailure: (message: string) => void) {
  let windowStart = 0;
  const seen = new Set<string>();
  return async (event: OperationalAlert): Promise<"delivered" | "unconfigured" | "suppressed" | "failed"> => {
    const url = endpoint();
    if (!url) { return "unconfigured"; }
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    const payload = {
      kind: event.kind,
      ...(event.statusCode ? { statusCode: event.statusCode } : {}),
      ...(event.requestId ? { requestIdHash: hash(event.requestId) } : {}),
      ...(event.shopId ? { shopIdHash: hash(event.shopId) } : {}),
    };
    if (Date.now() - windowStart >= 60_000) {
      seen.clear();
      windowStart = Date.now();
    }
    const key = `${payload.kind}:${payload.statusCode}:${payload.shopIdHash}`;
    if (seen.has(key) || seen.size >= 10) { return "suppressed"; }
    seen.add(key);
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(1000), redirect: "error",
      });
      await response.body?.cancel();
      if (!response.ok) { throw new Error("delivery_failed"); }
      return "delivered";
    } catch {
      logFailure("Operational alert delivery failed");
      return "failed";
    }
  };
}

const logger = new Logger("OperationalAlert");
export const sendOperationalAlert = createOperationalAlert(
  () => process.env.OPERATIONAL_ALERT_WEBHOOK_URL,
  (message) => logger.error(message),
);
