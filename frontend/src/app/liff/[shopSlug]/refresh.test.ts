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
