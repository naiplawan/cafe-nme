import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  createStaffAction: async (state: unknown) => state,
  setStaffActiveAction: async (state: unknown) => state,
  setStaffPinAction: async (state: unknown) => state,
}));

import * as staffForms from "./forms";
import { StaffRow } from "./forms";

const owner = { id: "staff-owner", name: "เจ้าของร้าน", role: "owner", hasPin: true, isActive: true };
const barista = { id: "staff-barista", name: "บาริสต้า", role: "barista", hasPin: true, isActive: true };

function renderRow(row: typeof owner, currentStaffId: string) {
  return renderToStaticMarkup(createElement(StaffRow, { row, currentStaffId }));
}

describe("staff forms", () => {
  it("explains why the owner account cannot be deactivated", () => {
    expect(renderRow(owner, "staff-manager")).toContain("บัญชีเจ้าของร้านไม่สามารถปิดใช้งานได้");
  });

  it("explains why the current account cannot be deactivated", () => {
    expect(renderRow(barista, "staff-barista")).toContain("บัญชีที่กำลังใช้งานอยู่ไม่สามารถปิดใช้งานได้");
  });

  it("renders successful action feedback as status and errors as alerts", () => {
    const ActionMessage = (staffForms as unknown as {
      StaffActionMessage?: typeof import("react").createElement;
    }).StaffActionMessage;
    expect(ActionMessage).toBeTypeOf("function");
    if (typeof ActionMessage !== "function") {
      return;
    }

    const success = renderToStaticMarkup(createElement(ActionMessage as never, { state: { message: "เปลี่ยน PIN แล้ว", success: true } }));
    const error = renderToStaticMarkup(createElement(ActionMessage as never, { state: { message: "PIN ไม่ถูกต้อง", success: false } }));
    expect(success).toContain('role="status"');
    expect(success).not.toContain('role="alert"');
    expect(error).toContain('role="alert"');
  });
});
