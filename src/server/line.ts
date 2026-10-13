import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { messagingApi } from "@line/bot-sdk";
import { db } from "@/db";
import { lineChannels, members, rewards, shops } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { renderRichMenuPng, RICH_MENU_LABELS } from "@/server/rich-menu-image";

export type LineConfig = {
  messagingChannelId: string | null;
  channelSecret: string | null;
  accessToken: string | null;
  loginChannelId: string | null;
  liffId: string | null;
  richMenuId: string | null;
};

export async function getLineConfig(shopId: string): Promise<LineConfig> {
  const [row] = await db.select().from(lineChannels).where(eq(lineChannels.shopId, shopId)).limit(1);
  return {
    messagingChannelId: row?.messagingChannelId ?? null,
    channelSecret: row?.channelSecretEnc ? decryptSecret(row.channelSecretEnc) : null,
    accessToken: row?.accessTokenEnc ? decryptSecret(row.accessTokenEnc) : null,
    loginChannelId: row?.loginChannelId ?? null,
    liffId: row?.liffId ?? null,
    richMenuId: row?.richMenuId ?? null,
  };
}

export async function saveLineConfig(shopId: string, input: Partial<Omit<LineConfig, "richMenuId">>): Promise<void> {
  const [old] = await db.select().from(lineChannels).where(eq(lineChannels.shopId, shopId)).limit(1);
  const values = {
    shopId,
    messagingChannelId: input.messagingChannelId ?? old?.messagingChannelId ?? null,
    channelSecretEnc: input.channelSecret ? encryptSecret(input.channelSecret) : old?.channelSecretEnc ?? null,
    accessTokenEnc: input.accessToken ? encryptSecret(input.accessToken) : old?.accessTokenEnc ?? null,
    loginChannelId: input.loginChannelId ?? old?.loginChannelId ?? null,
    liffId: input.liffId ?? old?.liffId ?? null,
  };
  await db.insert(lineChannels).values(values).onConflictDoUpdate({
    target: lineChannels.shopId,
    set: {
      messagingChannelId: values.messagingChannelId,
      channelSecretEnc: values.channelSecretEnc,
      accessTokenEnc: values.accessTokenEnc,
      loginChannelId: values.loginChannelId,
      liffId: values.liffId,
    },
  });
}

export async function verifyLineIdToken(shopSlug: string, idToken: string): Promise<{ lineUserId: string; name: string; pictureUrl: string | null } | null> {
  if (process.env.LINE_DEV_MOCK === "1" && process.env.NODE_ENV !== "production" && idToken.startsWith("dev:")) {
    return { lineUserId: idToken.slice(4), name: "Dev User", pictureUrl: null };
  }
  const [row] = await db.select({ loginChannelId: lineChannels.loginChannelId })
    .from(lineChannels).innerJoin(shops, eq(lineChannels.shopId, shops.id))
    .where(and(eq(shops.slug, shopSlug), eq(lineChannels.shopId, shops.id))).limit(1);
  if (!row?.loginChannelId) return null;
  try {
    const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: row.loginChannelId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { sub?: string; name?: string; picture?: string };
    if (!data.sub) return null;
    return { lineUserId: data.sub, name: data.name ?? "สมาชิก", pictureUrl: data.picture ?? null };
  } catch (error) {
    logger.warn({ err: error, shopSlug }, "LINE ID token verification failed");
    return null;
  }
}

export async function pushText(shopId: string, lineUserId: string, text: string): Promise<void> {
  const config = await getLineConfig(shopId);
  if (!config.accessToken) return;
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.accessToken });
  await client.pushMessage({ to: lineUserId, messages: [{ type: "text", text }] });
}

export async function pushRewardUnlocked(shopId: string, memberId: string): Promise<void> {
  try {
    const [row] = await db.select({ lineUserId: members.lineUserId }).from(members).innerJoin(
      rewards, and(eq(rewards.memberId, members.id), eq(rewards.shopId, shopId)),
    ).where(and(eq(members.shopId, shopId), eq(members.id, memberId), isNull(members.deletedAt))).limit(1);
    if (row?.lineUserId) await pushText(shopId, row.lineUserId, "🎉 ได้เครื่องดื่มฟรี 1 แก้ว");
  } catch (error) {
    logger.error({ err: error, shopId, memberId }, "Unable to send reward notification");
  }
}

export function richMenuAreas(liffId: string, basicId: string | null) {
  const liffUrl = (view: "card" | "stamps" | "menu" | "register") => `https://liff.line.me/${liffId}?view=${view}`;
  const actions = [
    { type: "uri" as const, label: RICH_MENU_LABELS[0], uri: liffUrl("card") },
    { type: "uri" as const, label: RICH_MENU_LABELS[1], uri: liffUrl("stamps") },
    { type: "uri" as const, label: RICH_MENU_LABELS[2], uri: liffUrl("menu") },
    { type: "uri" as const, label: RICH_MENU_LABELS[3], uri: liffUrl("register") },
    basicId
      ? { type: "uri" as const, label: RICH_MENU_LABELS[4], uri: `https://line.me/R/ti/p/${encodeURIComponent(basicId)}` }
      : { type: "uri" as const, label: RICH_MENU_LABELS[4], uri: liffUrl("card") },
    { type: "message" as const, label: RICH_MENU_LABELS[5], text: "ติดต่อร้าน" },
  ];
  return actions.map((action, index) => ({
    bounds: { x: (index % 3) * 833, y: Math.floor(index / 3) * 843, width: index % 3 === 2 ? 834 : 833, height: 843 },
    action,
  }));
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

export async function setupRichMenu(shopId: string): Promise<string> {
  const config = await getLineConfig(shopId);
  if (!config.accessToken) throw new Error("กรุณาตั้งค่า LINE access token ก่อน");
  if (!config.liffId) throw new Error("กรุณาตั้งค่า LIFF ID ก่อน");
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.accessToken });
  const blob = new messagingApi.MessagingApiBlobClient({ channelAccessToken: config.accessToken });
  let basicId: string | null = null;
  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { authorization: `Bearer ${config.accessToken}` },
    });
    if (!response.ok) throw new Error(`LINE bot info request failed with status ${response.status}`);
    const info = await response.json() as { basicId?: string };
    basicId = info.basicId ?? null;
  } catch (error) {
    logger.warn({ err: error, shopId }, "Unable to fetch LINE basic ID");
  }
  const areas = richMenuAreas(config.liffId, basicId);
  const { richMenuId } = await client.createRichMenu({
    size: { width: 2500, height: 1686 }, selected: true, name: "บัตรสมาชิก",
    chatBarText: "เมนูสมาชิก", areas,
  });
  const image = await renderRichMenuPng(shopId);
  await blob.setRichMenuImage(richMenuId, new Blob([new Uint8Array(image)], { type: "image/png" }));
  await client.setDefaultRichMenu(richMenuId);
  await db.insert(lineChannels).values({ shopId, richMenuId }).onConflictDoUpdate({
    target: lineChannels.shopId, set: { richMenuId },
  });
  // Remove the previous menu only once the new one is live, so members never end up without a menu.
  if (config.richMenuId && config.richMenuId !== richMenuId) {
    try {
      await client.deleteRichMenu(config.richMenuId);
    } catch (error) {
      if (!isNotFound(error)) logger.warn({ err: error, shopId }, "Unable to delete previous rich menu");
    }
  }
  return richMenuId;
}
