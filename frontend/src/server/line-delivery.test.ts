import { expect, it, vi } from "vitest";
vi.mock("@/server/internal-api", () => ({ internalApiFetch: async () => new Response(JSON.stringify({ messagingChannelId: null, channelSecretEnc: null, accessTokenEnc: null, loginChannelId: null, liffId: null, richMenuId: null })) }));
import { pushText } from "./line";
it("rejects receipt delivery when LINE is unconfigured", async () => {
  await expect(pushText("11111111-1111-4111-8111-111111111111", "fixture-user", "receipt")).rejects.toThrow("not configured");
});
