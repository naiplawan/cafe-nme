import { afterEach, describe, expect, it, vi } from "vitest";
import { findStaffSession, findStaffShops } from "./staff-session";

describe("staff session lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("includes the selected shop in the membership-scoped session request", async () => {
    vi.stubEnv("APP_SECRET", "a".repeat(32));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      staff: { id: "11111111-1111-4111-8111-111111111111", name: "Owner", role: "owner" },
      shop: { id: "22222222-2222-4222-8222-222222222222", name: "South" },
      shopId: "22222222-2222-4222-8222-222222222222",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await findStaffSession(
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(fetchMock.mock.calls[0][0]).toContain("/shops/22222222-2222-4222-8222-222222222222/staff-session");
  });

  it("lists memberships for the signed-in account", async () => {
    vi.stubEnv("APP_SECRET", "a".repeat(32));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      staff: { id: "11111111-1111-4111-8111-111111111111", name: "Owner", role: "owner" },
      shop: { id: "22222222-2222-4222-8222-222222222222", name: "South" },
      shopId: "22222222-2222-4222-8222-222222222222",
    }]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findStaffShops("33333333-3333-4333-8333-333333333333")).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/auth-users/33333333-3333-4333-8333-333333333333/shops");
  });
});
