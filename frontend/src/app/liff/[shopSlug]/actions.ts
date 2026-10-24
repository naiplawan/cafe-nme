"use server";

import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { createMemberToken } from "@/lib/member-token";

export interface MemberCardData {
  member: { displayName: string; phone: string | null; stampBalance: number; stampGoal: number; availableRewards: number; nextStampExpiryAt?: string | null; nextRewardExpiryAt?: string | null; history?: { id: string; delta: number; reason: string; createdAt: string; expiresAt: string | null }[] };
  qrToken: string;
}
export interface MemberActionState { message: string | null; success: boolean }

const UUID = z.uuid();
const cardResponseSchema = z.discriminatedUnion("registered", [
  z.object({ registered: z.literal(false) }),
  z.object({
    registered: z.literal(true),
    memberId: UUID,
    member: z.object({
      displayName: z.string(),
      phone: z.string().nullable(),
      stampBalance: z.number().int(),
      stampGoal: z.number().int().positive(),
      availableRewards: z.number().int().nonnegative(),
      nextStampExpiryAt: z.iso.datetime().nullable().default(null),
      nextRewardExpiryAt: z.iso.datetime().nullable().default(null),
      history: z.array(z.object({ id: UUID, delta: z.number().int(), reason: z.string(), createdAt: z.iso.datetime(), expiresAt: z.iso.datetime().nullable() })).default([]),
    }),
  }),
]);
const actionResponseSchema = z.object({ message: z.string().nullable(), success: z.boolean() });
const TRAILING_SLASH = /\/$/;

async function requestLiffApi(shopSlug: string, path: string, body?: unknown): Promise<unknown> {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) { throw new Error("API_BASE_URL is required to access LIFF member data"); }

  const response = await fetch(
    `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/liff/shops/${encodeURIComponent(shopSlug)}${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "x-internal-api-token": createInternalApiToken(),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    },
  );
  if (!response.ok) { throw new Error(`Nest LIFF API returned ${response.status}`); }
  return response.json();
}

export async function getMyCard(shopSlug: string, idToken: string): Promise<
  { registered: false } | { registered: true; member: MemberCardData["member"]; qrToken: string }
> {
  const value = await requestLiffApi(shopSlug, "/card", { idToken });
  const parsed = cardResponseSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest LIFF API returned an invalid member card payload"); }
  if (!parsed.data.registered) { return { registered: false }; }
  return {
    registered: true,
    member: parsed.data.member,
    qrToken: createMemberToken(parsed.data.memberId),
  };
}

export async function register(
  shopSlug: string,
  idToken: string,
  input: { phone: string; displayName: string; consent: boolean },
): Promise<MemberActionState> {
  const value = await requestLiffApi(shopSlug, "/register", { idToken, ...input });
  const parsed = actionResponseSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest LIFF API returned an invalid registration payload"); }
  return parsed.data;
}

export async function deleteMyData(shopSlug: string, idToken: string): Promise<MemberActionState> {
  const value = await requestLiffApi(shopSlug, "/delete", { idToken });
  const parsed = actionResponseSchema.safeParse(value);
  if (!parsed.success) { throw new Error("Nest LIFF API returned an invalid deletion payload"); }
  return parsed.data;
}
