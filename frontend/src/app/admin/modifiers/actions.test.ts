import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaff = vi.hoisted(() => vi.fn());
const createModifier = vi.hoisted(() => vi.fn());
const createModifierGroup = vi.hoisted(() => vi.fn());
const createStandardModifierGroups = vi.hoisted(() => vi.fn());
const deleteModifier = vi.hoisted(() => vi.fn());
const deleteModifierGroup = vi.hoisted(() => vi.fn());
const setGroupProducts = vi.hoisted(() => vi.fn());
const updateModifierGroup = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireStaff }));
vi.mock("@/server/modifiers", () => ({
  createModifier,
  createModifierGroup,
  createStandardModifierGroups,
  deleteModifier,
  deleteModifierGroup,
  setGroupProducts,
  updateModifierGroup,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createModifierAction, updateModifierGroupAction } from "./actions";

const session = {
  shopId: "shop-1",
  staff: { id: "staff-1", role: "owner" as const },
};

function groupFormData({ name, minSelect, maxSelect }: { name: string; minSelect: string; maxSelect: string }) {
  const data = new FormData();
  data.set("groupId", "group-1");
  data.set("name", name);
  data.set("minSelect", minSelect);
  data.set("maxSelect", maxSelect);
  return data;
}

function modifierFormData({ groupId = "00000000-0000-4000-8000-000000000001", name, priceDelta }: { groupId?: string; name: string; priceDelta: string }) {
  const data = new FormData();
  data.set("groupId", groupId);
  data.set("name", name);
  data.set("priceDelta", priceDelta);
  return data;
}

describe("modifier actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaff.mockResolvedValue(session);
  });

  it("returns normalized group values when the selection limits are invalid", async () => {
    const result = await updateModifierGroupAction({}, groupFormData({ name: "  ท็อปปิ้ง  ", minSelect: "2", maxSelect: "1" }));

    expect(result).toEqual({
      error: "ขั้นต่ำต้องไม่มากกว่าสูงสุด",
      values: { name: "ท็อปปิ้ง", minSelect: "2", maxSelect: "1" },
    });
    expect(updateModifierGroup).not.toHaveBeenCalled();
  });

  it("keeps normalized group values and hides service errors", async () => {
    updateModifierGroup.mockRejectedValue(new Error("duplicate group from database"));

    const result = await updateModifierGroupAction({}, groupFormData({ name: "  ท็อปปิ้ง  ", minSelect: "2", maxSelect: "3" }));

    expect(result).toEqual({
      error: "บันทึกกลุ่มตัวเลือกไม่สำเร็จ กรุณาลองใหม่",
      values: { name: "ท็อปปิ้ง", minSelect: "2", maxSelect: "3" },
    });
    expect(result.error).not.toContain("database");
  });

  it("returns modifier values when the price is invalid", async () => {
    const result = await createModifierAction({}, modifierFormData({ name: "  ไข่มุก  ", priceDelta: "ราคาไม่ทราบ" }));

    expect(result).toEqual({
      error: "ราคาไม่ถูกต้อง",
      values: { name: "ไข่มุก", priceDelta: "ราคาไม่ทราบ" },
    });
    expect(createModifier).not.toHaveBeenCalled();
  });

  it("keeps modifier values and hides service errors", async () => {
    createModifier.mockRejectedValue(new Error("database details"));

    const result = await createModifierAction({}, modifierFormData({ name: "  ไข่มุก  ", priceDelta: "15" }));

    expect(result).toEqual({
      error: "เพิ่มตัวเลือกไม่สำเร็จ กรุณาลองใหม่",
      values: { name: "ไข่มุก", priceDelta: "15" },
    });
    expect(result.error).not.toContain("database");
  });
});
