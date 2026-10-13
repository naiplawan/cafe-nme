import { describe, expect, it } from "vitest";
import { maskPhone, thaiInitial } from "./thai";

describe("thaiInitial", () => {
  it.each([
    ["เจ้าของร้าน", "จ"],
    ["โกโก้", "ก"],
    ["ไอซ์", "อ"],
    ["คุณแพรว", "พ"],
    ["พี่ต้น", "ต"],
    ["มินท์", "ม"],
    ["latte", "L"],
    ["  ชาไทย ", "ช"],
    ["เ", "เ"],
    ["", "?"],
  ])("%j -> %j", (name, expected) => {
    expect(thaiInitial(name)).toBe(expected);
  });
});

describe("maskPhone", () => {
  it("masks a Thai mobile number", () => {
    expect(maskPhone("0814821000")).toBe("081-xxx-1000");
    expect(maskPhone("081-482-1000")).toBe("081-xxx-1000");
  });

  it("leaves other values alone", () => {
    expect(maskPhone(null)).toBe("");
    expect(maskPhone("12345")).toBe("12345");
  });
});
