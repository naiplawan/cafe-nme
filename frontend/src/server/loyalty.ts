import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

const UUID = z.uuid();
const TRAILING_SLASH = /\/$/;
const memberSummarySchema = z.object({
  id: UUID,
  displayName: z.string(),
  phone: z.string().nullable(),
  lineLinked: z.boolean(),
  stampBalance: z.number().int(),
  stampGoal: z.number().int(),
  availableRewards: z.array(z.object({ id: UUID, createdAt: z.coerce.date() })),
});

export type MemberSummary = z.infer<typeof memberSummarySchema>;

const ledgerEntrySchema = z.object({
  id: UUID,
  delta: z.number().int(),
  reason: z.string(),
  orderId: UUID.nullable(),
  createdAt: z.coerce.date(),
});

async function requestApi(path: string, init?: RequestInit): Promise<unknown> {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) { throw new Error("API_BASE_URL is required to access loyalty data"); }
  const response = await fetch(`${apiBaseUrl.replace(TRAILING_SLASH, "")}${path}`, {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) { throw new Error(`Nest loyalty API returned ${response.status}`); }
  return response.json();
}

function memberPath(shopId: string, memberId: string): string {
  return `/v1/shops/${encodeURIComponent(UUID.parse(shopId))}/members/${encodeURIComponent(UUID.parse(memberId))}`;
}

export async function getMemberSummary(shopId: string, memberId: string): Promise<MemberSummary | null> {
  const value = await requestApi(`${memberPath(shopId, memberId)}/summary`);
  const parsed = memberSummarySchema.nullable().safeParse(value);
  if (!parsed.success) { throw new Error("Nest loyalty API returned an invalid member summary payload"); }
  return parsed.data;
}

export async function adjustStamps(
  shopId: string,
  memberId: string,
  delta: number,
  staffId: string,
  note?: string,
): Promise<MemberSummary> {
  const value = await requestApi(`${memberPath(shopId, memberId)}/stamp-adjustments`, {
    method: "POST",
    body: JSON.stringify({ delta, staffId, note }),
  });
  const parsed = memberSummarySchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest loyalty API returned an invalid stamp adjustment payload"); }
  return parsed.data;
}

export async function listLedger(
  shopId: string,
  memberId: string,
  limit = 50,
): Promise<z.infer<typeof ledgerEntrySchema>[]> {
  const boundedLimit = Math.max(0, Math.min(500, Math.trunc(limit)));
  const query = new URLSearchParams({ limit: String(boundedLimit) });
  const value = await requestApi(`${memberPath(shopId, memberId)}/ledger?${query.toString()}`);
  const parsed = z.array(ledgerEntrySchema).safeParse(value);
  if (!parsed.success) { throw new Error("Nest loyalty API returned an invalid ledger payload"); }
  return parsed.data;
}
