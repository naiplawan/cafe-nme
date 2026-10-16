import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { verifyMemberToken } from "@/lib/member-token";

const UUID = z.uuid();
const TRAILING_SLASH = /\/$/;
const memberRowSchema = z.object({
  id: UUID,
  displayName: z.string(),
  phone: z.string().nullable(),
  lineUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  stampBalance: z.number().int(),
});

export type MemberRow = z.infer<typeof memberRowSchema>;

async function requestApi(path: string, init?: RequestInit): Promise<unknown> {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) { throw new Error("API_BASE_URL is required to access members"); }
  const response = await fetch(`${apiBaseUrl.replace(TRAILING_SLASH, "")}${path}`, {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (response.status === 409) {
    // A conflict carries a message meant for staff (e.g. "เบอร์โทรนี้มีสมาชิกแล้ว").
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : null;
    throw new Error(message ?? "Nest members API returned 409");
  }
  if (!response.ok) { throw new Error(`Nest members API returned ${response.status}`); }
  // Nest sends a handler's `null` (e.g. an unknown member) as an empty body.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const shopPath = (shopId: string) => `/v1/shops/${encodeURIComponent(UUID.parse(shopId))}/members`;

export async function findMemberByToken(shopId: string, token: string): Promise<string | null> {
  const memberId = verifyMemberToken(token);
  if (!memberId) { return null; }
  const validMemberId = UUID.safeParse(memberId);
  if (!validMemberId.success) { return null; }
  const value = await requestApi(`${shopPath(shopId)}/by-token/${encodeURIComponent(validMemberId.data)}`);
  const parsed = z.object({ id: UUID }).nullable().safeParse(value);
  if (!parsed.success) { throw new Error("Nest members API returned an invalid token lookup payload"); }
  return parsed.data?.id ?? null;
}

// Digits only, with the Thai country code (+66 81…) mapped to the local form (081…).
function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("66") && digits.length > 2 ? `0${digits.slice(2)}` : digits;
}

export async function findMembersByPhone(shopId: string, phoneQuery: string): Promise<MemberRow[]> {
  const digits = phoneDigits(phoneQuery);
  if (!digits) { return []; }
  const value = await requestApi(`${shopPath(shopId)}/by-phone?phone=${encodeURIComponent(digits)}`);
  const parsed = z.array(memberRowSchema).safeParse(value);
  if (!parsed.success) { throw new Error("Nest members API returned an invalid phone lookup payload"); }
  return parsed.data;
}

// Duplicate walk-in phones are rejected so a POS operator must select the existing member.
export async function createMemberByPhone(shopId: string, phone: string, displayName: string): Promise<MemberRow> {
  const value = await requestApi(shopPath(shopId), {
    method: "POST",
    body: JSON.stringify({ phone, displayName }),
  });
  const parsed = memberRowSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest members API returned an invalid created member payload"); }
  return parsed.data;
}

export async function listMembers(
  shopId: string,
  opts: { search?: string; limit?: number; offset?: number; availableReward?: boolean } = {},
): Promise<{ rows: MemberRow[]; total: number }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (opts.search !== undefined) { query.set("search", opts.search); }
  if (opts.availableReward) { query.set("availableReward", "true"); }
  const value = await requestApi(`${shopPath(shopId)}?${query.toString()}`);
  const parsed = z.object({ rows: z.array(memberRowSchema), total: z.number().int().nonnegative() }).safeParse(value);
  if (!parsed.success) { throw new Error("Nest members API returned an invalid member list payload"); }
  return parsed.data;
}

export async function deleteMemberData(shopId: string, memberId: string): Promise<void> {
  const validMemberId = UUID.parse(memberId);
  const value = await requestApi(`${shopPath(shopId)}/${encodeURIComponent(validMemberId)}/personal-data`, { method: "DELETE" });
  if (!z.object({ ok: z.literal(true) }).safeParse(value).success) {
    throw new Error("Nest members API returned an invalid deletion payload");
  }
}
