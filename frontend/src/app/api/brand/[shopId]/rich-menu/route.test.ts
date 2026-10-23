import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), requireStaff: vi.fn() }));
const membership = vi.hoisted(() => ({ findStaffSession: vi.fn() }));
const renderRichMenuPng = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => auth);
vi.mock("@/server/staff-session", () => membership);
vi.mock("@/server/rich-menu-image", () => ({ renderRichMenuPng }));

import { GET } from "./route";

const shopId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";
const request = (id = shopId) => GET(new Request(`http://localhost/api/brand/${id}/rich-menu`), {
  params: Promise.resolve({ shopId: id }),
});

describe("rich-menu image authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.getUser.mockResolvedValue({ id: userId, email: "owner@example.com" });
    auth.requireStaff.mockRejectedValue(new Error("active shop cookie is absent outside /admin"));
    membership.findStaffSession.mockResolvedValue({
      shopId, shop: { id: shopId, name: "Branch" }, staff: { id: staffId, name: "Owner", role: "owner" },
    });
    renderRichMenuPng.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
  });
  afterEach(() => vi.restoreAllMocks());

  it("serves an authorized branch without an active-shop cookie", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(membership.findStaffSession).toHaveBeenCalledWith(userId, shopId);
    expect(renderRichMenuPng).toHaveBeenCalledWith(shopId);
  });

  it("does not render another shop's image for a nonmember", async () => {
    membership.findStaffSession.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(renderRichMenuPng).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    auth.getUser.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(membership.findStaffSession).not.toHaveBeenCalled();
    expect(renderRichMenuPng).not.toHaveBeenCalled();
  });

  it("rejects invalid shop identifiers before querying membership", async () => {
    expect((await request("invalid")).status).toBe(404);
    expect(membership.findStaffSession).not.toHaveBeenCalled();
    expect(renderRichMenuPng).not.toHaveBeenCalled();
  });
});
