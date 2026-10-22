import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const line = vi.hoisted(() => ({ pushRewardUnlocked: vi.fn() }));
vi.mock("@/server/line", () => line);

import { checkout, CheckoutError } from "./orders";

const shopId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const orderId = "44444444-4444-4444-8444-444444444444";
const productId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";

const member = {
  id: memberId,
  displayName: "สมาชิกทดสอบ",
  phone: "0812345678",
  lineLinked: true,
  stampBalance: 0,
  stampGoal: 3,
  availableRewards: [],
};

const receipt = {
  orderId,
  dailyNo: 7,
  subtotalSatang: 5000,
  discountSatang: 0,
  totalSatang: 5000,
  changeSatang: 0,
  stampsEarned: 3,
  rewardsCreated: 1,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("checkout transport boundary", () => {
  beforeEach(() => {
    process.env.APP_SECRET = "test-secret-that-is-long-enough-for-hmac";
    line.pushRewardUnlocked.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("notifies a fresh checkout once and skips the notification on replay", async () => {
    const checkoutResponses = [
      { ...receipt, replayed: false },
      { ...receipt, replayed: true },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/members/${memberId}/summary`)) {
        return jsonResponse(member);
      }
      if (url.endsWith("/orders")) {
        const response = checkoutResponses.shift();
        if (!response) {
          throw new Error("unexpected extra checkout request");
        }
        return jsonResponse(response);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = { shopId, staffId };
    const input = {
      requestId,
      lines: [{ productId, qty: 1, modifierIds: [], note: "  ไม่หวาน " }],
      memberId,
      redeemRewardId: null,
      payment: { method: "promptpay" as const },
    };

    const fresh = await checkout(session, input);
    expect(fresh).toMatchObject({ orderId, replayed: false, rewardsCreated: 1, member });
    expect(line.pushRewardUnlocked).toHaveBeenCalledTimes(1);
    expect(line.pushRewardUnlocked).toHaveBeenCalledWith(shopId, memberId);

    const replay = await checkout(session, input);
    expect(replay).toMatchObject({ orderId, replayed: true, rewardsCreated: 1, member });
    expect(line.pushRewardUnlocked).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

it("classifies validation rejection as definitive but retains uncertainty for server failures", async () => {
  const input = { lines: [{ productId, qty: 1, modifierIds: [] }], payment: { method: "promptpay" as const } };
  for (const code of ["cart_limit_exceeded", "price_changed"]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 400 })));
    await expect(checkout({ shopId, staffId }, input)).rejects.toMatchObject({ code });
  }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status: 400 })));
  await expect(checkout({ shopId, staffId }, input)).rejects.toBeInstanceOf(CheckoutError);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(checkout({ shopId, staffId }, input)).rejects.not.toBeInstanceOf(CheckoutError);
  vi.unstubAllGlobals();
});
