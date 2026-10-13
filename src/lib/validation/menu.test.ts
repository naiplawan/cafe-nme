import { describe, expect, it } from "vitest";
import { modifierGroupSchema, modifierSchema, productSchema } from "./menu";

describe("productSchema", () => {
  it("parses a form submission into satang and booleans", () => {
    const r = productSchema.parse({
      name: " Latte ",
      price: "55",
      categoryId: "",
      imageUrl: "",
      earnsStamp: "on",
    });
    expect(r).toEqual({
      name: "Latte",
      price: 5500,
      categoryId: null,
      imageUrl: null,
      earnsStamp: true,
      isActive: false,
    });
  });

  it("rejects negative and malformed prices", () => {
    expect(productSchema.safeParse({ name: "x", price: "-5" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "x", price: "abc" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(productSchema.safeParse({ name: "  ", price: "10" }).success).toBe(false);
  });
});

describe("modifierGroupSchema", () => {
  it("accepts a required single choice (sweetness)", () => {
    expect(
      modifierGroupSchema.parse({ name: "ความหวาน", minSelect: "1", maxSelect: "1" }),
    ).toEqual({ name: "ความหวาน", minSelect: 1, maxSelect: 1 });
  });

  it("coerces string selection limits to numbers", () => {
    const result = modifierGroupSchema.parse({
      name: "ประเภท",
      minSelect: "0",
      maxSelect: "2",
    });

    expect(result.minSelect).toBe(0);
    expect(result.maxSelect).toBe(2);
    expect(typeof result.minSelect).toBe("number");
    expect(typeof result.maxSelect).toBe("number");
  });

  it("rejects min greater than max", () => {
    expect(
      modifierGroupSchema.safeParse({ name: "x", minSelect: "2", maxSelect: "1" }).success,
    ).toBe(false);
  });

  it("rejects max of zero", () => {
    expect(
      modifierGroupSchema.safeParse({ name: "x", minSelect: "0", maxSelect: "0" }).success,
    ).toBe(false);
  });
});

describe("modifierSchema", () => {
  it("allows a negative price delta (e.g. no milk -5)", () => {
    const r = modifierSchema.parse({
      groupId: "0b6b0c8e-6c4a-4d0e-9a2f-3d6f5c1b2a10",
      name: "ไม่ใส่นม",
      priceDelta: "-5",
    });
    expect(r.priceDelta).toBe(-500);
  });
});
