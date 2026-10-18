import "server-only";
import { messagingApi, validateSignature } from "@line/bot-sdk";
import { after } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { logger } from "@/lib/logger";
import { readBoundedBody } from "@/server/read-bounded-body";

const TRAILING_SLASH = /\/$/;
const UUID = z.uuid();
const MAX_WEBHOOK_BYTES = 1_048_576;
const webhookConfigSchema = z.object({
  channelSecretEnc: z.string().nullable(),
  accessTokenEnc: z.string().nullable(),
  liffId: z.string().nullable(),
  shopName: z.string(),
}).strict();

async function getWebhookConfig(shopId: string) {
  const base = process.env.API_BASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101");
  if (!base) { throw new Error("API_BASE_URL is required to access LINE webhook configuration"); }
  const response = await fetch(
    `${base.replace(TRAILING_SLASH, "")}/v1/shops/${encodeURIComponent(UUID.parse(shopId))}/line/webhook-config`,
    { headers: { "x-internal-api-token": createInternalApiToken() }, cache: "no-store" },
  );
  if (!response.ok) { throw new Error(`Nest LINE API returned ${response.status}`); }
  const value: unknown = await response.json();
  if (value === null) { return null; }
  const parsed = webhookConfigSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest LINE API returned an invalid webhook configuration payload"); }
  return parsed.data;
}

interface Event {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
}

export async function POST(request: Request, context: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await context.params;
  let body: string;
  try {
    body = await readBoundedBody(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    const status = error instanceof Error && error.message === "Body too large" ? 413 : 400;
    return new Response(status === 413 ? "Payload too large" : "Invalid body", { status });
  }
  const signature = request.headers.get("x-line-signature") ?? "";
  const config = await getWebhookConfig(shopId);
  if (!config?.channelSecretEnc || !config.accessTokenEnc) { return new Response("LINE webhook is not configured", { status: 401 }); }
  const secret = decryptSecret(config.channelSecretEnc);
  if (!validateSignature(body, secret, signature)) { return new Response("Invalid signature", { status: 401 }); }

  let events: Event[];
  try {
    events = (JSON.parse(body) as { events?: Event[] }).events ?? [];
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  if (config.liffId) {
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: decryptSecret(config.accessTokenEnc) });
    const liffUrl = (view: "card" | "stamps" | "menu") => `https://liff.line.me/${config.liffId}?view=${view}`;
    after(async () => {
      await Promise.allSettled(events.flatMap((event) => {
        if (!event.replyToken) { return []; }
        let text: string | null = null;
        if (event.type === "follow") { text = `ยินดีต้อนรับสู่${config.shopName}\nเปิดบัตรสมาชิก: ${liffUrl("card")}`; }
        else if (event.type === "message" && event.message?.type === "text") {
          if (event.message.text === "บัตรสมาชิก") { text = `บัตรสมาชิกของคุณ: ${liffUrl("card")}`; }
          else if (event.message.text === "แต้ม") { text = `แต้มของคุณ: ${liffUrl("stamps")}`; }
          else if (event.message.text === "เมนู") { text = `ดูเมนูของร้าน: ${liffUrl("menu")}`; }
          else if (event.message.text === "ติดต่อร้าน") {
            text = `ขอบคุณที่ติดต่อร้าน ทางร้านจะตอบกลับในแชทนี้เร็ว ๆ นี้\nบัตรสมาชิก: ${liffUrl("card")}`;
          }
        }
        if (!text) { return []; }
        return [client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text }] })
          .catch((error) => logger.warn({ err: error, shopId }, "LINE webhook reply failed"))];
      }));
    });
  }
  return new Response("OK", { status: 200 });
}
