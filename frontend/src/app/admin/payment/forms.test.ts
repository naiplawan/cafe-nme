import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));
vi.mock("./actions", () => ({
  clearPromptPayAction: async (state: unknown) => state,
  previewPromptPayAction: async () => ({ ok: false, message: "ยังไม่ได้ตั้งค่า" }),
  savePromptPayAction: async (state: unknown) => state,
}));

import { createPreviewRequestGuard, PromptPaySettingsForm } from "./forms";

function render(configured: boolean) {
  return renderToStaticMarkup(createElement(PromptPaySettingsForm, {
    configured,
    maskedId: configured ? "••••••••5678" : null,
  }));
}

describe("PromptPay settings form", () => {
  it("labels the first saved ID field as a PromptPay number and hides preview before setup", () => {
    const markup = render(false);

    expect(markup).toContain("หมายเลขพร้อมเพย์");
    expect(markup).not.toContain("ดู QR ตรวจชื่อผู้รับ");
  });

  it("labels a replacement field and explains the saved-ID recipient preview", () => {
    const markup = render(true);

    expect(markup).toContain("หมายเลขพร้อมเพย์ใหม่");
    expect(markup).toContain("ดู QR ตรวจชื่อผู้รับ");
    expect(markup).toContain("ใช้ตรวจชื่อผู้รับเท่านั้น ไม่ต้องโอนเงินจริง");
    expect(markup).toContain("หน้านี้ไม่ได้ยืนยันการเชื่อมต่อกับธนาคาร");
  });
});

describe("PromptPay preview request lifecycle", () => {
  it("does not publish an older async result after a newer preview starts", async () => {
    const guard = createPreviewRequestGuard();
    const firstRequest = guard.begin();
    const firstResult = Promise.resolve("old QR").then((value) => guard.isCurrent(firstRequest) ? value : null);
    const secondRequest = guard.begin();
    const secondResult = Promise.resolve("new QR").then((value) => guard.isCurrent(secondRequest) ? value : null);

    await expect(firstResult).resolves.toBeNull();
    await expect(secondResult).resolves.toBe("new QR");
  });

  it("invalidates an in-flight result when saving or clearing starts", async () => {
    const guard = createPreviewRequestGuard();
    const request = guard.begin();
    const result = Promise.resolve("old QR").then((value) => guard.isCurrent(request) ? value : null);
    guard.invalidate();

    await expect(result).resolves.toBeNull();
  });

  it.each([
    { mutation: "saving", savePending: true, clearPending: false },
    { mutation: "clearing", savePending: false, clearPending: true },
  ])("disables preview while the $mutation mutation is pending", ({ savePending, clearPending }) => {
    const useActionStateMock = vi.mocked(React.useActionState);
    useActionStateMock
      .mockReturnValueOnce([{ message: null, success: false }, vi.fn(), savePending] as never)
      .mockReturnValueOnce([{ message: null, success: false }, vi.fn(), clearPending] as never);

    try {
      const markup = render(true);
      expect(markup).toContain('disabled=""');
    } finally {
      useActionStateMock.mockClear();
    }
  });
});
