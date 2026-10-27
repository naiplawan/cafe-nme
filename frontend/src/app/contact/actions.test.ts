import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ submitContactMessage: vi.fn() }));
vi.mock("@/server/contact", () => api);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }) }));

import { CONTACT_MESSAGES } from "@/lib/contact-schema";
import { type ContactState, sendContactMessage } from "./actions";

const idle: ContactState = { status: "idle", message: "", fieldErrors: {}, values: {} };

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields: Record<string, string> = {
    name: "สมชาย ใจดี",
    email: "Somchai@Example.com",
    phone: "",
    shopName: "",
    topic: "demo",
    message: "อยากขอดูตัวอย่างการใช้งานระบบ POS",
    consent: "on",
    website: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== "") {
      data.set(key, value);
    }
  }
  return data;
}

afterEach(() => vi.resetAllMocks());

it("blocks invalid input before calling the API and keeps what was typed", async () => {
  const state = await sendContactMessage(idle, form({ email: "not-an-email", message: "สั้น", consent: "" }));
  expect(state.status).toBe("error");
  expect(state.message).toBe(CONTACT_MESSAGES.invalid);
  expect(new Set(Object.keys(state.fieldErrors))).toEqual(new Set(["consent", "email", "message"]));
  expect(state.values.name).toBe("สมชาย ใจดี");
  expect(api.submitContactMessage).not.toHaveBeenCalled();
});

it("looks successful to bots that fill the honeypot, without calling the API", async () => {
  const state = await sendContactMessage(idle, form({ website: "https://spam.example" }));
  expect(state).toMatchObject({ status: "success", message: CONTACT_MESSAGES.success });
  expect(api.submitContactMessage).not.toHaveBeenCalled();
});

it("sends the trimmed message with the client address and reports success", async () => {
  api.submitContactMessage.mockResolvedValue({ ok: true });
  const state = await sendContactMessage(idle, form({ phone: "081 234 5678" }));
  expect(state).toMatchObject({ status: "success", message: CONTACT_MESSAGES.success });
  expect(api.submitContactMessage).toHaveBeenCalledWith(
    expect.objectContaining({ name: "สมชาย ใจดี", phone: "081 234 5678", topic: "demo", consent: true }),
    "203.0.113.7",
  );
});

it.each([
  [400, CONTACT_MESSAGES.invalid],
  [429, CONTACT_MESSAGES.rateLimited],
  [500, CONTACT_MESSAGES.failed],
])("maps API status %i to its Thai message and keeps the typed values", async (status, message) => {
  api.submitContactMessage.mockResolvedValue({ ok: false, status });
  const state = await sendContactMessage(idle, form());
  expect(state).toMatchObject({ status: "error", message });
  expect(state.values.email).toBe("Somchai@Example.com");
});

it("shows the generic message when the API cannot be reached", async () => {
  api.submitContactMessage.mockRejectedValue(new Error("offline"));
  const state = await sendContactMessage(idle, form());
  expect(state).toMatchObject({ status: "error", message: CONTACT_MESSAGES.failed });
});

it("keeps the consent tick when another field fails validation", async () => {
  const state = await sendContactMessage(idle, form({ email: "not-an-email" }));
  expect(state.fieldErrors.consent).toBeUndefined();
  expect(state.values.consent).toBe("on");
  const unticked = await sendContactMessage(idle, form({ email: "not-an-email", consent: "" }));
  expect(unticked.values.consent).toBe("");
  expect(unticked.fieldErrors.consent).toBeDefined();
});
