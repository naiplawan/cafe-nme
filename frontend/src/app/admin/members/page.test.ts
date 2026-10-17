import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMembers = vi.fn();
const memberOverview = vi.fn();
const memberGrowth = vi.fn();

vi.mock("@/lib/auth", () => ({ requireStaff: vi.fn(async () => ({ shopId: "shop" })) }));
vi.mock("@/lib/business-date", () => ({ businessDate: vi.fn(() => "2026-10-17") }));
vi.mock("@/server/members", () => ({ listMembers }));
vi.mock("@/server/reports", () => ({ memberGrowth, memberOverview }));

describe("member list empty states", () => {
  beforeEach(() => {
    listMembers.mockResolvedValue({ rows: [], total: 0 });
    memberOverview.mockResolvedValue({ total: 4, lineLinked: 2, active30d: 1, rewardsAvailable: 0 });
    memberGrowth.mockResolvedValue([]);
  });

  it("uses filtered empty copy and a clear link when a search has no matches", async () => {
    const { default: MembersPage } = await import("./page");
    const markup = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({ q: "มะลิ" }) }));
    expect(markup).toContain("ไม่พบสมาชิกตามตัวกรอง");
    expect(markup).toContain("ล้างตัวกรอง");
    expect(markup).not.toContain("ยังไม่พบสมาชิก");
  });

  it("uses filtered empty copy for an empty reward filter", async () => {
    const { default: MembersPage } = await import("./page");
    const markup = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({ reward: "available" }) }));
    expect(markup).toContain("ไม่พบสมาชิกตามตัวกรอง");
    expect(markup).toContain("ล้างตัวกรอง");
  });

  it("keeps onboarding copy only for an unfiltered empty shop", async () => {
    memberOverview.mockResolvedValue({ total: 0, lineLinked: 0, active30d: 0, rewardsAvailable: 0 });
    const { default: MembersPage } = await import("./page");
    const markup = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("ยังไม่พบสมาชิก");
    expect(markup).not.toContain("ไม่พบสมาชิกตามตัวกรอง");
  });
});
