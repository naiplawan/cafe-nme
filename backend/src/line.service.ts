import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

interface LineConfigInput {
  messagingChannelId: string | null;
  channelSecretEnc: string | null;
  accessTokenEnc: string | null;
  loginChannelId: string | null;
  liffId: string | null;
}

function readConfigInput(value: unknown): LineConfigInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("LINE configuration must be an object");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set(["messagingChannelId", "channelSecretEnc", "accessTokenEnc", "loginChannelId", "liffId"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new BadRequestException("LINE configuration contains an unsupported field");
  }
  for (const key of allowed) {
    if (!(key in input) || input[key] === null) { continue; }
    if (typeof input[key] !== "string" || input[key].length > 8192) {
      throw new BadRequestException("LINE configuration contains an invalid value");
    }
  }
  return {
    messagingChannelId: typeof input.messagingChannelId === "string" ? input.messagingChannelId : null,
    channelSecretEnc: typeof input.channelSecretEnc === "string" ? input.channelSecretEnc : null,
    accessTokenEnc: typeof input.accessTokenEnc === "string" ? input.accessTokenEnc : null,
    loginChannelId: typeof input.loginChannelId === "string" ? input.loginChannelId : null,
    liffId: typeof input.liffId === "string" ? input.liffId : null,
  };
}

@Injectable()
export class LineService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getConfig(shopId: string) {
    const [row] = await this.database.connection`
      select messaging_channel_id as "messagingChannelId",
        channel_secret_enc as "channelSecretEnc", access_token_enc as "accessTokenEnc",
        login_channel_id as "loginChannelId", liff_id as "liffId", rich_menu_id as "richMenuId"
      from line_channels where shop_id = ${shopId}::uuid limit 1`;
    return {
      messagingChannelId: row?.messagingChannelId ?? null,
      channelSecretEnc: row?.channelSecretEnc ?? null,
      accessTokenEnc: row?.accessTokenEnc ?? null,
      loginChannelId: row?.loginChannelId ?? null,
      liffId: row?.liffId ?? null,
      richMenuId: row?.richMenuId ?? null,
    };
  }

  async saveConfig(shopId: string, value: unknown) {
    const input = readConfigInput(value);
    await this.database.connection`
      insert into line_channels (
        shop_id, messaging_channel_id, channel_secret_enc, access_token_enc, login_channel_id, liff_id
      ) values (
        ${shopId}::uuid, ${input.messagingChannelId ?? null}, ${input.channelSecretEnc ?? null},
        ${input.accessTokenEnc ?? null}, ${input.loginChannelId ?? null}, ${input.liffId ?? null}
      ) on conflict (shop_id) do update set
        messaging_channel_id = coalesce(excluded.messaging_channel_id, line_channels.messaging_channel_id),
        channel_secret_enc = coalesce(excluded.channel_secret_enc, line_channels.channel_secret_enc),
        access_token_enc = coalesce(excluded.access_token_enc, line_channels.access_token_enc),
        login_channel_id = coalesce(excluded.login_channel_id, line_channels.login_channel_id),
        liff_id = coalesce(excluded.liff_id, line_channels.liff_id)`;
    return { ok: true };
  }

  async saveRichMenu(shopId: string, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { richMenuId?: unknown }).richMenuId !== "string") {
      throw new BadRequestException("Rich menu ID is required");
    }
    const richMenuId = (value as { richMenuId: string }).richMenuId.trim();
    if (!richMenuId || richMenuId.length > 256) { throw new BadRequestException("Rich menu ID is invalid"); }
    await this.database.connection`
      insert into line_channels (shop_id, rich_menu_id) values (${shopId}::uuid, ${richMenuId})
      on conflict (shop_id) do update set rich_menu_id = excluded.rich_menu_id`;
    return { ok: true };
  }

  async getLoginChannel(shopSlug: string) {
    const [row] = await this.database.connection`
      select lc.login_channel_id as "loginChannelId"
      from line_channels lc join shops s on s.id = lc.shop_id
      where s.slug = ${shopSlug} limit 1`;
    return { loginChannelId: row?.loginChannelId ?? null };
  }

  async getRewardMember(shopId: string, memberId: string) {
    const [row] = await this.database.connection`
      select m.line_user_id as "lineUserId"
      from members m
      join rewards r on r.member_id = m.id and r.shop_id = ${shopId}::uuid
      where m.shop_id = ${shopId}::uuid and m.id = ${memberId}::uuid and m.deleted_at is null
      limit 1`;
    return { lineUserId: row?.lineUserId ?? null };
  }

  async getWebhookConfig(shopId: string) {
    const [row] = await this.database.connection`
      select lc.channel_secret_enc as "channelSecretEnc", lc.access_token_enc as "accessTokenEnc",
        lc.liff_id as "liffId", s.name as "shopName"
      from line_channels lc join shops s on s.id = lc.shop_id
      where lc.shop_id = ${shopId}::uuid limit 1`;
    if (!row) { return null; }
    return {
      channelSecretEnc: row.channelSecretEnc ?? null,
      accessTokenEnc: row.accessTokenEnc ?? null,
      liffId: row.liffId ?? null,
      shopName: row.shopName,
    };
  }
}
