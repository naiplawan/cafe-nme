// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getMyCard: vi.fn(), register: vi.fn(), deleteMyData: vi.fn() }));
vi.mock("./actions", () => api);
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,test" } }));
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => React.createElement("img", props) }));
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props) }));
vi.mock("@/components/motion/gsap", () => ({ useGSAP: () => ({}), prefersReducedMotion: () => true, gsap: {}, MOTION: {} }));
import { MemberApp } from "./member-app";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
it("hides a stale QR after refresh failure and restores it only after a successful retry", async () => {
  vi.useFakeTimers();
  const card = { registered: true, member: { displayName: "Member", phone: "0812345678", stampBalance: 1, stampGoal: 10, availableRewards: 0 }, qrToken: "token-1" };
  api.getMyCard.mockResolvedValueOnce(card).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...card, qrToken: "token-2" });
  await act(async () => { render(React.createElement(MemberApp, { shopSlug: "cafe", shopName: "Cafe", liffId: "dev", devMock: true, menu: [], brand: { accent: "#123456", custom: false, logoUrl: null } })); });
  expect(screen.getByAltText("QR สำหรับสะสมแสตมป์")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(screen.queryByAltText("QR สำหรับสะสมแสตมป์")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("อัปเดต QR ไม่สำเร็จ");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" })); });
  expect(screen.getByAltText("QR สำหรับสะสมแสตมป์")).toBeTruthy();
  expect(api.getMyCard).toHaveBeenCalledTimes(3);
});

it("shows expiry deadlines and dated earn/use/expire history", async () => {
  api.getMyCard.mockResolvedValue({ registered: true, qrToken: "token", member: {
    displayName: "Member", phone: "0812345678", stampBalance: 1, stampGoal: 10, availableRewards: 1,
    nextStampExpiryAt: "2027-10-17T03:00:00Z", nextRewardExpiryAt: "2027-11-17T03:00:00Z",
    history: [
      { id: "earn", delta: 5, reason: "earn", createdAt: "2026-10-17T03:00:00Z", expiresAt: "2027-10-17T03:00:00Z" },
      { id: "use", delta: -3, reason: "redeem", createdAt: "2026-10-18T03:00:00Z", expiresAt: null },
      { id: "expire", delta: -1, reason: "expire", createdAt: "2026-10-19T03:00:00Z", expiresAt: null },
    ],
  } });
  await act(async () => { render(React.createElement(MemberApp, { shopSlug: "cafe", shopName: "Cafe", liffId: "dev", devMock: true, menu: [], brand: { accent: "#123456", custom: false, logoUrl: null } })); });
  expect(screen.getByText(/แสตมป์หมดอายุครั้งถัดไป/)).toBeTruthy();
  expect(screen.getByText(/รางวัลหมดอายุครั้งถัดไป/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "ประวัติแสตมป์" })).toBeTruthy();
  expect(screen.getByText("รับแสตมป์")).toBeTruthy();
  expect(screen.getByText("แลกรางวัล")).toBeTruthy();
  expect(screen.getByText("แสตมป์หมดอายุ")).toBeTruthy();
});
