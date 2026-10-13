import { describe, expect, it } from "vitest";
import { richMenuAreas } from "@/server/line";

describe("richMenuAreas", () => {
  it("covers the rich menu without gaps or overlaps and maps each button to its destination", () => {
    const areas = richMenuAreas("1234567890-AbCd", "@169lpzmu");

    expect(areas).toHaveLength(6);
    expect(areas.map(({ bounds }) => bounds)).toEqual([
      { x: 0, y: 0, width: 833, height: 843 },
      { x: 833, y: 0, width: 833, height: 843 },
      { x: 1666, y: 0, width: 834, height: 843 },
      { x: 0, y: 843, width: 833, height: 843 },
      { x: 833, y: 843, width: 833, height: 843 },
      { x: 1666, y: 843, width: 834, height: 843 },
    ]);

    for (let left = 0; left < areas.length; left += 1) {
      const a = areas[left]!.bounds;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(2500);
      expect(a.y + a.height).toBeLessThanOrEqual(1686);
      for (let right = left + 1; right < areas.length; right += 1) {
        const b = areas[right]!.bounds;
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps).toBe(false);
      }
    }
    expect(areas.reduce((total, { bounds }) => total + bounds.width * bounds.height, 0)).toBe(2500 * 1686);

    expect(areas.map(({ action }) => action)).toEqual([
      { type: "uri", label: "บัตรสมาชิก", uri: "https://liff.line.me/1234567890-AbCd?view=card" },
      { type: "uri", label: "แต้มของฉัน", uri: "https://liff.line.me/1234567890-AbCd?view=stamps" },
      { type: "uri", label: "เมนู", uri: "https://liff.line.me/1234567890-AbCd?view=menu" },
      { type: "uri", label: "สมัครสมาชิก", uri: "https://liff.line.me/1234567890-AbCd?view=register" },
      { type: "uri", label: "ร้านของเรา", uri: "https://line.me/R/ti/p/%40169lpzmu" },
      { type: "message", label: "ติดต่อร้าน", text: "ติดต่อร้าน" },
    ]);
    expect(areas.every(({ action }) => action.label.length <= 20)).toBe(true);
  });

  it("uses the card LIFF link when the LINE basic ID is unavailable", () => {
    const areas = richMenuAreas("1234567890-AbCd", null);

    expect(areas[4]?.action).toEqual({
      type: "uri",
      label: "ร้านของเรา",
      uri: "https://liff.line.me/1234567890-AbCd?view=card",
    });
  });
});
