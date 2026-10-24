import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireStaff: vi.fn(async () => ({ shopId: "shop", staff: { role: "manager" } })) }));
vi.mock("@/server/loyalty", () => ({
  getMemberSummary: vi.fn(async () => ({
    id: "member",
    displayName: "มะลิ",
    phone: "0812345678",
    lineLinked: false,
    stampBalance: 10,
    stampGoal: 10,
    nextStampExpiryAt: new Date("2027-10-17T03:00:00Z"),
    availableRewards: [{ id: "reward", createdAt: new Date("2026-10-17T03:00:00.000Z"), expiresAt: new Date("2027-10-17T03:00:00Z") }],
  })),
  listLedger: vi.fn(async () => []),
}));
vi.mock("../forms", () => ({ AdjustStampsForm: () => null, DeleteMemberForm: () => null }));

describe("member reward guidance", () => {
  it("shows earned dates and directs redemption to the POS without an admin redeem action", async () => {
    const { default: MemberDetailPage } = await import("./page");
    const markup = renderToStaticMarkup(await MemberDetailPage({ params: Promise.resolve({ memberId: "member" }) }));
    expect(markup).toContain("ได้รับวันที่");
    expect(markup).toContain("หน้าขาย (POS)");
    expect(markup).not.toContain("type=\"submit\"");
  });
});

it("shows stamp and reward expiry dates", async () => {
  const { default: MemberDetailPage } = await import("./page");
  const markup = renderToStaticMarkup(await MemberDetailPage({ params: Promise.resolve({ memberId: "member" }) }));
  expect(markup).toContain("แสตมป์หมดอายุครั้งถัดไป");
  expect(markup).toContain("หมดอายุวันที่");
  expect(markup).toContain("2570");
});
