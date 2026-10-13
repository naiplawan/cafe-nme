import { describe, expect, it } from "vitest";
import { stockMenuModifierGroupNames } from "@/server/menu";

describe("stock menu modifier groups", () => {
  it("selects the existing group names allowed for each catalog kind", () => {
    expect(stockMenuModifierGroupNames("coffee")).toEqual(["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"]);
    expect(stockMenuModifierGroupNames("milk")).toEqual(["ความหวาน", "ประเภท", "นม"]);
    expect(stockMenuModifierGroupNames("drink")).toEqual(["ความหวาน", "ประเภท"]);
    expect(stockMenuModifierGroupNames("bakery")).toEqual([]);
  });
});
