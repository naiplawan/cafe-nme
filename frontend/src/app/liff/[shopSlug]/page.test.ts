import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("./member-app", () => ({ MemberApp: () => null }));

import LiffMemberPage from "./page";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("shows not found for a missing LIFF shop returned as an empty response", async () => {
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret".repeat(4));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null)));
  await expect(LiffMemberPage({ params: Promise.resolve({ shopSlug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
});
