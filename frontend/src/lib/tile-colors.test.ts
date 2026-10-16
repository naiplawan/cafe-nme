import { describe, expect, it } from "vitest";
import { productSchema } from "@/lib/validation/menu";
import { TILE_COLORS, tileColorOf } from "./tile-colors";

describe("tile colours", () => {
  it("uses the chosen colour when it is in the palette", () => {
    expect(tileColorOf({ name: "ลาเต้", tileColor: "sky" })).toBe("sky");
  });

  it("picks a stable palette colour from the name otherwise", () => {
    const auto = tileColorOf({ name: "ลาเต้" });
    expect(TILE_COLORS).toContain(auto);
    expect(tileColorOf({ name: "ลาเต้", tileColor: "not-a-colour" })).toBe(auto);
    expect(tileColorOf({ name: "ลาเต้", tileColor: null })).toBe(auto);
  });

  it("stores an empty or unknown choice as automatic", () => {
    const base = { name: "ชา", price: "45", categoryId: "", imageUrl: "" };
    expect(productSchema.parse({ ...base, tileColor: "rose" }).tileColor).toBe("rose");
    expect(productSchema.parse({ ...base, tileColor: "" }).tileColor).toBeNull();
    expect(productSchema.parse({ ...base, tileColor: "red" }).tileColor).toBeNull();
  });
});
