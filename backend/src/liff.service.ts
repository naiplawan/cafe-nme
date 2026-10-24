import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveSharedLoyalty } from "./loyalty-groups.service.js";
import { DatabaseService } from "./database.service.js";

const SHOP_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i;
const PHONE = /^0\d{9}$/;
const ID_TOKEN_MAX_LENGTH = 8192;

interface LineIdentity { lineUserId: string; name: string }

function requestObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function validateKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new BadRequestException("Request body contains unsupported fields");
  }
}

function validateSlug(shopSlug: string): void {
  if (!SHOP_SLUG.test(shopSlug)) { throw new BadRequestException("Shop slug is invalid"); }
}

function readIdToken(value: unknown): string {
  const body = requestObject(value);
  const { idToken } = body;
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > ID_TOKEN_MAX_LENGTH) {
    throw new BadRequestException("LINE ID token is invalid");
  }
  return idToken;
}

@Injectable()
export class LiffService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async getShop(shopSlug: string) {
    validateSlug(shopSlug);
    const [shop] = await this.database.connection<{
      shopId: string; name: string; stampGoal: number; liffId: string | null;
    }[]>`
      select s.id::text as "shopId", s.name, s.stamp_goal as "stampGoal", lc.liff_id as "liffId"
      from shops s
      left join line_channels lc on lc.shop_id = s.id
      where s.slug = ${shopSlug}
      limit 1
    `;
    return shop ?? null;
  }

  async getMyCard(shopSlug: string, value: unknown) {
    validateSlug(shopSlug);
    validateKeys(requestObject(value), ["idToken"]);
    const idToken = readIdToken(value);
    const identity = await this.identify(shopSlug, idToken);
    if (!identity) { return { registered: false as const }; }

    return this.database.connection.begin(async (tx) => {
      const [row] = await tx<{
        id: string; shopId: string; displayName: string; phone: string | null; stampGoal: number;
      }[]>`
        select m.id::text as id, s.id::text as "shopId", m.display_name as "displayName", m.phone,
          s.stamp_goal as "stampGoal"
        from members m join shops s on s.id = m.shop_id
        where s.slug = ${shopSlug} and m.line_user_id = ${identity.lineUserId} and m.deleted_at is null
        limit 1
      `;
      if (!row?.phone) { return { registered: false as const }; }
      const state = await resolveSharedLoyalty(tx, row.shopId, row.id);
      if (!state) { return { registered: false as const }; }
      const history = await tx<{ id: string; delta: number; reason: string; createdAt: Date; expiresAt: Date | null; sourceEntryId: string | null; orderId: string | null }[]>`
        select id::text as id, delta, reason, created_at as "createdAt", expires_at as "expiresAt", source_entry_id::text as "sourceEntryId", order_id::text as "orderId"
        from stamp_ledger where member_id = any(${state.aliases.map((alias) => alias.memberId)}::uuid[])
        order by created_at desc, id desc limit 20
      `;
      return {
        registered: true as const,
        memberId: row.id,
        member: {
          displayName: row.displayName,
          phone: row.phone,
          stampBalance: state.stampBalance,
          stampGoal: Number(row.stampGoal),
          availableRewards: state.availableRewards.length,
          nextStampExpiryAt: state.nextStampExpiryAt,
          nextRewardExpiryAt: state.nextRewardExpiryAt,
          history,
        },
      };
    });
  }

  async register(shopSlug: string, value: unknown): Promise<{ message: string | null; success: boolean }> {
    validateSlug(shopSlug);
    const body = requestObject(value);
    validateKeys(body, ["idToken", "phone", "displayName", "consent"]);
    const idToken = readIdToken(body);
    const identity = await this.identify(shopSlug, idToken);
    if (!identity) { return { message: "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่", success: false }; }
    if (body.consent !== true) { return { message: "กรุณายินยอมให้ใช้ข้อมูลเพื่อสมัครสมาชิก", success: false }; }
    if (typeof body.phone !== "string" || !PHONE.test(body.phone)) {
      return { message: "กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลัก", success: false };
    }
    if (typeof body.displayName !== "string" || body.displayName.length > 80) {
      throw new BadRequestException("Display name is invalid");
    }

    const displayName = body.displayName.trim() || identity.name;
    const [shop] = await this.database.connection<{ id: string }[]>`
      select id::text as id from shops where slug = ${shopSlug} limit 1
    `;
    if (!shop) { return { message: "ไม่พบร้าน", success: false }; }

    try {
      await this.database.connection`
        insert into members (shop_id, line_user_id, phone, display_name, consent_at)
        values (${shop.id}::uuid, ${identity.lineUserId}, ${body.phone}, ${displayName}, now())
        on conflict (shop_id, line_user_id) do update set
          phone = excluded.phone,
          display_name = excluded.display_name,
          consent_at = now(),
          deleted_at = null
      `;
      return { message: null, success: true };
    } catch {
      return { message: "เบอร์โทรนี้มีสมาชิกแล้ว กรุณาติดต่อที่ร้าน", success: false };
    }
  }

  async deleteMyData(shopSlug: string, value: unknown): Promise<{ message: string; success: boolean }> {
    validateSlug(shopSlug);
    validateKeys(requestObject(value), ["idToken"]);
    const idToken = readIdToken(value);
    const identity = await this.identify(shopSlug, idToken);
    if (!identity) { return { message: "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่", success: false }; }

    const [shop] = await this.database.connection<{ id: string }[]>`
      select id::text as id from shops where slug = ${shopSlug} limit 1
    `;
    if (!shop) { return { message: "ไม่พบร้าน", success: false }; }

    await this.database.connection`
      update members m
      set phone = null, line_user_id = null, display_name = 'ลบข้อมูลแล้ว', deleted_at = now()
      where m.shop_id = ${shop.id}::uuid
        and m.line_user_id = ${identity.lineUserId} and m.deleted_at is null
    `;
    return { message: "ลบข้อมูลสมาชิกแล้ว", success: true };
  }

  private async identify(shopSlug: string, idToken: string): Promise<LineIdentity | null> {
    const [channel] = await this.database.connection<{ loginChannelId: string | null }[]>`
      select lc.login_channel_id as "loginChannelId"
      from shops s left join line_channels lc on lc.shop_id = s.id
      where s.slug = ${shopSlug}
      limit 1
    `;
    if (!channel) { return null; }

    if (this.config.get<string>("LINE_DEV_MOCK") === "1"
      && this.config.get<string>("NODE_ENV") === "development"
      && idToken.startsWith("dev:")) {
      const lineUserId = idToken.slice(4);
      return lineUserId.length > 0 && lineUserId.length <= 255
        ? { lineUserId, name: "Dev User" }
        : null;
    }
    if (!channel.loginChannelId) { return null; }

    try {
      const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: idToken, client_id: channel.loginChannelId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) { return null; }
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("sub" in data) || typeof data.sub !== "string" || !data.sub || data.sub.length > 255) {
        return null;
      }
      return {
        lineUserId: data.sub,
        name: "name" in data && typeof data.name === "string" && data.name.trim() ? data.name.slice(0, 80) : "สมาชิก",
      };
    } catch {
      return null;
    }
  }
}
