import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("rejects an unconfigured webhook when Nest returns an empty body", async () => {
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret".repeat(4));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null)));
  const response = await POST(new Request("http://localhost/api/line/webhook/missing", {
    method: "POST", body: JSON.stringify({ events: [] }),
  }), { params: Promise.resolve({ shopId: "11111111-1111-4111-8111-111111111111" }) });
  expect(response.status).toBe(401);
});
