import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReconciliationReport, type ReviewRow } from "./report";
vi.mock("./actions", () => ({ reviewPaymentAction: async () => ({ message: null }) }));
const row: ReviewRow = { paymentId:"11111111-1111-4111-8111-111111111111", dailyNo:1, method:"cash", expectedSatang:6500,
  observedSatang:6000,differenceSatang:-500,status:"discrepancy",recordedBy:"Cashier",reviewedBy:"Manager",reviewedAt:"2026-10-23T10:00:00Z",source:"staff",note:"Short" };
describe("receipt reconciliation report", () => {
  it("separates methods and shows pending amounts independently from cash differences", () => {
    const html=renderToStaticMarkup(createElement(ReconciliationReport,{rows:[row,
      {...row,paymentId:"22222222-2222-4222-8222-222222222222",dailyNo:2,observedSatang:7000,differenceSatang:500},
      {...row,paymentId:"33333333-3333-4333-8333-333333333333",dailyNo:3,method:"promptpay",status:"pending",observedSatang:null,differenceSatang:null,source:null,reviewedBy:null,reviewedAt:null,note:null}]}));
    expect(html).toContain("เงินสด"); expect(html).toContain("PromptPay");
    expect(html).toContain("ขาด ฿5"); expect(html).toContain("เกิน ฿5");
    expect(html).toContain("รอตรวจ 1 บิล · ฿65");
    expect(html).toContain("ตรวจโดยพนักงาน"); expect(html).toContain("Manager");
    expect(html).not.toContain("ธนาคารยืนยันแล้ว");
  });
});
