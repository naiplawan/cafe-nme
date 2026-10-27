import "server-only";
import type { ContactInput } from "@/lib/contact-schema";
import { internalApiFetch } from "./internal-api";

export type ContactResult = { ok: true } | { ok: false; status: number };

// POST /v1/contact-messages: 201 stored, 400 invalid, 429 rate limited.
export async function submitContactMessage(input: ContactInput, clientAddress: string): Promise<ContactResult> {
  const response = await internalApiFetch("/v1/contact-messages", {
    method: "POST",
    headers: { "x-client-address": clientAddress },
    body: JSON.stringify(input),
  });
  return response.ok ? { ok: true } : { ok: false, status: response.status };
}
