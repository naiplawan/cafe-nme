import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PendingCheckoutInput } from "@/lib/checkout-attempt";

vi.mock("@/app/pos/checkout-actions", () => ({ checkoutAction: vi.fn() }));

import { CheckoutRecovery } from "./checkout-recovery";

const pending: PendingCheckoutInput = {
  requestId: "66666666-6666-4666-8666-666666666666",
  lines: [{ productId: "coffee", qty: 1, modifierIds: [] }],
  memberId: null,
  redeemRewardId: null,
  payment: { method: "promptpay" },
};

describe("checkout recovery", () => {
  it("keeps a sign-in route available when the original staff session must be restored", () => {
    const markup = renderToStaticMarkup(createElement(CheckoutRecovery, {
      pending, onRecovered: vi.fn(), onRejected: vi.fn(),
    }));
    expect(markup).toContain('href="/pos/login"');
  });

  it("shows a recovery action before ordinary POS editing", () => {
    const markup = renderToStaticMarkup(createElement(CheckoutRecovery, {
      pending,
      onRecovered: vi.fn(),
      onRejected: () => true,
    }));

    expect(markup).toContain("พบรายการชำระเงินที่ยังไม่ยืนยัน");
    expect(markup).toContain("ตรวจสอบรายการเดิมอีกครั้ง");
  });
});
