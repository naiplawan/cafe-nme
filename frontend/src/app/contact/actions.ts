"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { CONTACT_MESSAGES, contactSchema } from "@/lib/contact-schema";
import { submitContactMessage } from "@/server/contact";

export type ContactField = "name" | "email" | "phone" | "shopName" | "topic" | "message" | "consent";
export interface ContactState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Partial<Record<ContactField, string>>;
  values: Partial<Record<ContactField, string>>;
}

const FIELDS: readonly ContactField[] = ["name", "email", "phone", "shopName", "topic", "message", "consent"];

const STATUS_MESSAGES: Record<number, string> = { 400: CONTACT_MESSAGES.invalid, 429: CONTACT_MESSAGES.rateLimited };

async function clientAddress() {
  const address = (await headers()).get("x-real-ip")?.trim() || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  if (!isIP(address)) {
    throw new Error("Client address unavailable");
  }
  return address;
}

export async function sendContactMessage(_previous: ContactState, data: FormData): Promise<ContactState> {
  // Hidden field a person never fills in: look successful to bots without calling the API.
  if (String(data.get("website") ?? "").trim() !== "") {
    return { status: "success", message: CONTACT_MESSAGES.success, fieldErrors: {}, values: {} };
  }

  const values: ContactState["values"] = {};
  for (const field of FIELDS) {
    values[field] = String(data.get(field) ?? "").trim();
  }
  const parsed = contactSchema.safeParse({
    name: values.name,
    email: values.email,
    phone: values.phone || undefined,
    shopName: values.shopName || undefined,
    topic: values.topic,
    message: values.message,
    consent: data.get("consent") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: CONTACT_MESSAGES.invalid, fieldErrors, values };
  }

  try {
    const result = await submitContactMessage(parsed.data, await clientAddress());
    if (result.ok) {
      return { status: "success", message: CONTACT_MESSAGES.success, fieldErrors: {}, values: {} };
    }
    return { status: "error", message: STATUS_MESSAGES[result.status] ?? CONTACT_MESSAGES.failed, fieldErrors: {}, values };
  } catch {
    return { status: "error", message: CONTACT_MESSAGES.failed, fieldErrors: {}, values };
  }
}
