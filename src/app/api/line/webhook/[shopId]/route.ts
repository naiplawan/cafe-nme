import "server-only";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { messagingApi, validateSignature } from "@line/bot-sdk";
import { db } from "@/db";
import { lineChannels, shops } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";

type Event = {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
};

export async function POST(request: Request, context: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await context.params;
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  const [config] = await db.select({
    secret: lineChannels.channelSecretEnc,
    token: lineChannels.accessTokenEnc,
    liffId: lineChannels.liffId,
    shopName: shops.name,
  }).from(lineChannels).innerJoin(shops, and(eq(shops.id, lineChannels.shopId), eq(lineChannels.shopId, shopId)))
    .where(eq(lineChannels.shopId, shopId)).limit(1);
  if (!config?.secret || !config.token) return new Response("LINE webhook is not configured", { status: 401 });
  const secret = decryptSecret(config.secret);
  if (!validateSignature(body, secret, signature)) return new Response("Invalid signature", { status: 401 });

  let events: Event[];
  try {
    events = (JSON.parse(body) as { events?: Event[] }).events ?? [];
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  if (config.liffId) {
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: decryptSecret(config.token) });
    const liffUrl = (view: "card" | "stamps" | "menu") => `https://liff.line.me/${config.liffId}?view=${view}`;
    after(async () => {
      await Promise.allSettled(events.flatMap((event) => {
        if (!event.replyToken) return [];
        let text: string | null = null;
        if (event.type === "follow") text = `ยินดีต้อนรับสู่${config.shopName}\nเปิดบัตรสมาชิก: ${liffUrl("card")}`;
        else if (event.type === "message" && event.message?.type === "text") {
          if (event.message.text === "บัตรสมาชิก") text = `บัตรสมาชิกของคุณ: ${liffUrl("card")}`;
          else if (event.message.text === "แต้ม") text = `แต้มของคุณ: ${liffUrl("stamps")}`;
          else if (event.message.text === "เมนู") text = `ดูเมนูของร้าน: ${liffUrl("menu")}`;
          else if (event.message.text === "ติดต่อร้าน") {
            text = `ขอบคุณที่ติดต่อร้าน ทางร้านจะตอบกลับในแชทนี้เร็ว ๆ นี้\nบัตรสมาชิก: ${liffUrl("card")}`;
          }
        }
        if (!text) return [];
        return [client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text }] })
          .catch((error) => logger.warn({ err: error, shopId }, "LINE webhook reply failed"))];
      }));
    });
  }
  return new Response("OK", { status: 200 });
}
