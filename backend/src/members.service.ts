import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_TEXT = /^\d+$/;
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export interface MemberRow {
  id: string;
  displayName: string;
  phone: string | null;
  lineUserId: string | null;
  createdAt: Date;
  stampBalance: number;
}

function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("66") && digits.length > 2 ? `0${digits.slice(2)}` : digits;
}

function parseLimit(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) { return fallback; }
  if (!INTEGER_TEXT.test(value)) { throw new BadRequestException(`${name} must be an integer`); }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${name} is outside the allowed range`);
  }
  return parsed;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function parseCreate(value: unknown) {
  const body = object(value);
  if (typeof body.phone !== "string" || typeof body.displayName !== "string") {
    throw new BadRequestException("Phone and display name are required");
  }
  const phone = phoneDigits(body.phone);
  const displayName = body.displayName.trim();
  if (phone.length < 6 || phone.length > 20) { throw new BadRequestException("Phone number is invalid"); }
  if (!displayName || displayName.length > 80) { throw new BadRequestException("Display name must be 1 to 80 characters"); }
  return { phone, displayName };
}

@Injectable()
export class MembersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findById(shopId: string, memberId: string): Promise<{ id: string } | null> {
    const [member] = await this.database.connection<{ id: string }[]>`
      select id::text as id from members
      where shop_id = ${shopId}::uuid and id = ${memberId}::uuid and deleted_at is null
      limit 1
    `;
    return member ?? null;
  }

  async findByPhone(shopId: string, phoneQuery: string): Promise<MemberRow[]> {
    const digits = phoneDigits(phoneQuery);
    if (!digits) { return []; }
    return this.database.connection<MemberRow[]>`
      select m.id::text as id, m.display_name as "displayName", m.phone,
        m.line_user_id as "lineUserId", m.created_at as "createdAt",
        coalesce(sum(l.delta), 0)::int as "stampBalance"
      from members m
      left join stamp_ledger l on l.member_id = m.id and l.shop_id = ${shopId}::uuid
      where m.shop_id = ${shopId}::uuid and m.deleted_at is null
        and (m.phone = ${digits} or m.phone like ${`${digits}%`})
      group by m.id
      order by m.phone
      limit 10
    `;
  }

  async createByPhone(shopId: string, value: unknown): Promise<MemberRow> {
    const input = parseCreate(value);
    const db = this.database.connection;
    const [existing] = await db<{ id: string }[]>`
      select id::text as id from members
      where shop_id = ${shopId}::uuid and phone = ${input.phone} and deleted_at is null
      limit 1
    `;
    if (existing) { throw new ConflictException("เบอร์โทรนี้มีสมาชิกแล้ว"); }
    const [row] = await db<Omit<MemberRow, "stampBalance">[]>`
      insert into members (shop_id, phone, display_name)
      values (${shopId}::uuid, ${input.phone}, ${input.displayName})
      returning id::text as id, display_name as "displayName", phone,
        line_user_id as "lineUserId", created_at as "createdAt"
    `;
    return { ...row, stampBalance: 0 };
  }

  async list(
    shopId: string,
    opts: { search?: string; limit?: string; offset?: string; availableReward?: string },
  ): Promise<{ rows: MemberRow[]; total: number }> {
    const limit = parseLimit(opts.limit, 25, 1, 100, "limit");
    const offset = parseLimit(opts.offset, 0, 0, Number.MAX_SAFE_INTEGER, "offset");
    if (opts.availableReward !== undefined && opts.availableReward !== "true" && opts.availableReward !== "false") {
      throw new BadRequestException("availableReward must be true or false");
    }
    const search = opts.search?.trim() || null;
    const digits = search ? phoneDigits(search) : "";
    const hasPhoneDigits = digits.length > 0;
    const availableReward = opts.availableReward === "true";
    const db = this.database.connection;
    const [rows, counts] = await Promise.all([
      db<MemberRow[]>`
        select m.id::text as id, m.display_name as "displayName", m.phone,
          m.line_user_id as "lineUserId", m.created_at as "createdAt",
          coalesce(sum(l.delta), 0)::int as "stampBalance"
        from members m
        left join stamp_ledger l on l.member_id = m.id and l.shop_id = ${shopId}::uuid
        where m.shop_id = ${shopId}::uuid and m.deleted_at is null
          and (${search}::text is null or m.display_name like ${search ? `%${search}%` : ""}
            ${hasPhoneDigits ? db`or m.phone like ${`%${digits}%`}` : db``})
          and (not ${availableReward}::boolean or exists (
            select 1 from rewards r where r.member_id = m.id and r.shop_id = ${shopId}::uuid and r.status = 'available'
          ))
        group by m.id
        order by m.created_at asc
        limit ${limit} offset ${offset}
      `,
      db<{ total: number }[]>`
        select count(*)::int as total from members m
        where m.shop_id = ${shopId}::uuid and m.deleted_at is null
          and (${search}::text is null or m.display_name like ${search ? `%${search}%` : ""}
            ${hasPhoneDigits ? db`or m.phone like ${`%${digits}%`}` : db``})
          and (not ${availableReward}::boolean or exists (
            select 1 from rewards r where r.member_id = m.id and r.shop_id = ${shopId}::uuid and r.status = 'available'
          ))
      `,
    ]);
    return { rows, total: Number(counts[0]?.total ?? 0) };
  }

  async deletePersonalData(shopId: string, memberId: string): Promise<{ ok: true }> {
    await this.database.connection`
      update members set phone = null, line_user_id = null, display_name = 'ลบข้อมูลแล้ว', deleted_at = now()
      where shop_id = ${shopId}::uuid and id = ${memberId}::uuid
    `;
    return { ok: true };
  }

  async getSummary(shopId: string, memberId: string) {
    const db = this.database.connection;
    const [member] = await db<{
      id: string; displayName: string; phone: string | null; lineUserId: string | null; stampGoal: number;
    }[]>`
      select m.id::text as id, m.display_name as "displayName", m.phone,
        m.line_user_id as "lineUserId", s.stamp_goal as "stampGoal"
      from members m join shops s on s.id = m.shop_id
      where m.id = ${memberId}::uuid and m.shop_id = ${shopId}::uuid and m.deleted_at is null
      limit 1
    `;
    if (!member) { return null; }
    const [balance] = await db<{ value: number }[]>`
      select coalesce(sum(delta), 0)::int as value from stamp_ledger
      where shop_id = ${shopId}::uuid and member_id = ${memberId}::uuid
    `;
    const availableRewards = await db<{ id: string; createdAt: Date }[]>`
      select id::text as id, created_at as "createdAt" from rewards
      where shop_id = ${shopId}::uuid and member_id = ${memberId}::uuid and status = 'available'
      order by created_at asc
    `;
    return {
      id: member.id,
      displayName: member.displayName,
      phone: member.phone,
      lineLinked: member.lineUserId !== null,
      stampBalance: Number(balance?.value ?? 0),
      stampGoal: Number(member.stampGoal),
      availableRewards,
    };
  }

  async listLedger(shopId: string, memberId: string, rawLimit?: string) {
    const limit = parseLimit(rawLimit, 50, 0, 500, "limit");
    return this.database.connection<{
      id: string; delta: number; reason: string; orderId: string | null; createdAt: Date;
    }[]>`
      select l.id::text as id, l.delta, l.reason, l.order_id::text as "orderId", l.created_at as "createdAt"
      from stamp_ledger l
      join members m on m.id = l.member_id and m.shop_id = ${shopId}::uuid
      where l.shop_id = ${shopId}::uuid and l.member_id = ${memberId}::uuid
      order by l.created_at desc
      limit ${limit}
    `;
  }

  async adjustStamps(shopId: string, memberId: string, value: unknown) {
    const body = object(value);
    if (!Number.isSafeInteger(body.delta) || (body.delta as number) < INT32_MIN || (body.delta as number) > INT32_MAX) {
      throw new BadRequestException("Stamp delta must be a 32-bit integer");
    }
    if (typeof body.staffId !== "string" || !UUID.test(body.staffId)) {
      throw new BadRequestException("Staff id is invalid");
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
      throw new BadRequestException("Note must be text");
    }
    const delta = body.delta as number;
    const { staffId } = body;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 200) { throw new BadRequestException("Note must be at most 200 characters"); }
    const db = this.database.connection;
    await db.begin(async (tx) => {
      const [member] = await tx<{ id: string }[]>`
        select id::text as id from members
        where id = ${memberId}::uuid and shop_id = ${shopId}::uuid and deleted_at is null
        limit 1
      `;
      const [actor] = await tx<{ id: string }[]>`
        select id::text as id from staff where id = ${staffId}::uuid and shop_id = ${shopId}::uuid limit 1
      `;
      if (!member || !actor) { throw new NotFoundException("Member or staff not found"); }
      await tx`
        insert into stamp_ledger (shop_id, member_id, delta, reason, staff_id)
        values (${shopId}::uuid, ${memberId}::uuid, ${delta}, 'adjust', ${staffId}::uuid)
      `;
      await tx`
        insert into audit_log (shop_id, actor, action, payload)
        values (${shopId}::uuid, ${staffId}::uuid, 'stamps.adjust', ${JSON.stringify({ memberId, delta, note: note || null })}::jsonb)
      `;
    });
    const summary = await this.getSummary(shopId, memberId);
    if (!summary) { throw new NotFoundException("Member not found"); }
    return summary;
  }
}
