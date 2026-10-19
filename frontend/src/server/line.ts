import "server-only";
import { messagingApi } from "@line/bot-sdk";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { internalApiFetch, internalApiUrl } from "@/server/internal-api";
import { RICH_MENU_LABELS, renderRichMenuPng } from "@/server/rich-menu-image";

export interface LineConfig {
  messagingChannelId: string | null;
  channelSecret: string | null;
  accessToken: string | null;
  loginChannelId: string | null;
  liffId: string | null;
  richMenuId: string | null;
}

const UUID = z.uuid();
const apiConfigSchema = z.object({
  messagingChannelId: z.string().nullable(),
  channelSecretEnc: z.string().nullable(),
  accessTokenEnc: z.string().nullable(),
  loginChannelId: z.string().nullable(),
  liffId: z.string().nullable(),
  richMenuId: z.string().nullable(),
}).strict();
const okSchema = z.object({ ok: z.literal(true) }).strict();

async function requestLineApi(path: string, init?: RequestInit): Promise<unknown> {
  const response = await internalApiFetch(path, init, "API_BASE_URL is required to access LINE configuration");
  if (!response.ok) { throw new Error(`Nest LINE API returned ${response.status}`); }
  return response.json();
}

const shopLinePath = (shopId: string) => `/v1/shops/${encodeURIComponent(UUID.parse(shopId))}/line`;

function fromApiConfig(value: unknown): LineConfig {
  const parsed = apiConfigSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest LINE API returned an invalid configuration payload"); }
  return {
    messagingChannelId: parsed.data.messagingChannelId,
    channelSecret: parsed.data.channelSecretEnc ? decryptSecret(parsed.data.channelSecretEnc) : null,
    accessToken: parsed.data.accessTokenEnc ? decryptSecret(parsed.data.accessTokenEnc) : null,
    loginChannelId: parsed.data.loginChannelId,
    liffId: parsed.data.liffId,
    richMenuId: parsed.data.richMenuId,
  };
}

export async function getLineConfig(shopId: string): Promise<LineConfig> {
  const value = await requestLineApi(`${shopLinePath(shopId)}/config`);
  return fromApiConfig(value);
}

export async function saveLineConfig(shopId: string, input: Partial<Omit<LineConfig, "richMenuId">>): Promise<void> {
  const value = await requestLineApi(`${shopLinePath(shopId)}/config`, {
    method: "PUT",
    body: JSON.stringify({
      messagingChannelId: input.messagingChannelId ?? null,
      channelSecretEnc: input.channelSecret ? encryptSecret(input.channelSecret) : null,
      accessTokenEnc: input.accessToken ? encryptSecret(input.accessToken) : null,
      loginChannelId: input.loginChannelId ?? null,
      liffId: input.liffId ?? null,
    }),
  });
  if (!okSchema.safeParse(value).success) { throw new Error("Nest LINE API returned an invalid save payload"); }
}

export async function verifyLineIdToken(shopSlug: string, idToken: string): Promise<{ lineUserId: string; name: string; pictureUrl: string | null } | null> {
  if (process.env.LINE_DEV_MOCK === "1" && process.env.NODE_ENV !== "production" && idToken.startsWith("dev:")) {
    return { lineUserId: idToken.slice(4), name: "Dev User", pictureUrl: null };
  }
  const value = await requestLineApi(`/v1/line/shops/by-slug/${encodeURIComponent(shopSlug)}/login-channel`);
  const parsed = z.object({ loginChannelId: z.string().nullable() }).strict().safeParse(value);
  if (!parsed.success) { throw new Error("Nest LINE API returned an invalid login channel payload"); }
  if (!parsed.data.loginChannelId) { return null; }
  try {
    const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: parsed.data.loginChannelId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) { return null; }
    const data = await response.json() as { sub?: string; name?: string; picture?: string };
    if (!data.sub) { return null; }
    return { lineUserId: data.sub, name: data.name ?? "สมาชิก", pictureUrl: data.picture ?? null };
  } catch (error) {
    logger.warn({ err: error, shopSlug }, "LINE ID token verification failed");
    return null;
  }
}

export async function pushText(shopId: string, lineUserId: string, text: string): Promise<void> {
  const config = await getLineConfig(shopId);
  if (!config.accessToken) { return; }
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.accessToken });
  await client.pushMessage({ to: lineUserId, messages: [{ type: "text", text }] });
}

export async function pushRewardUnlocked(shopId: string, memberId: string): Promise<void> {
  try {
    const value = await requestLineApi(`${shopLinePath(shopId)}/reward-member/${encodeURIComponent(UUID.parse(memberId))}`);
    const parsed = z.object({ lineUserId: z.string().nullable() }).strict().safeParse(value);
    if (!parsed.success) { throw new Error("Nest LINE API returned an invalid reward member payload"); }
    if (parsed.data.lineUserId) { await pushText(shopId, parsed.data.lineUserId, "🎉 ได้เครื่องดื่มฟรี 1 แก้ว"); }
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
  if (!config.accessToken) { throw new Error("กรุณาตั้งค่า LINE access token ก่อน"); }
  if (!config.liffId) { throw new Error("กรุณาตั้งค่า LIFF ID ก่อน"); }
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.accessToken });
  const blob = new messagingApi.MessagingApiBlobClient({ channelAccessToken: config.accessToken });
  let basicId: string | null = null;
  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { authorization: `Bearer ${config.accessToken}` },
    });
    if (!response.ok) { throw new Error(`LINE bot info request failed with status ${response.status}`); }
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
  const saved = await requestLineApi(`${shopLinePath(shopId)}/rich-menu`, {
    method: "PUT",
    body: JSON.stringify({ richMenuId }),
  });
  if (!okSchema.safeParse(saved).success) { throw new Error("Nest LINE API returned an invalid rich menu save payload"); }
  // Remove the previous menu only once the new one is live, so members never end up without a menu.
  if (config.richMenuId && config.richMenuId !== richMenuId) {
    try {
      await client.deleteRichMenu(config.richMenuId);
    } catch (error) {
      if (!isNotFound(error)) { logger.warn({ err: error, shopId }, "Unable to delete previous rich menu"); }
    }
  }
  return richMenuId;
}
