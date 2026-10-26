import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_ACCENT, INK } from "@/lib/brand";

export const alt = "YELO Coffee ระบบ POS ร้านกาแฟ พร้อมบัตรสะสมแต้มบน LINE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "src/server/fonts/IBMPlexSansThai-Bold.ttf")),
    readFile(join(process.cwd(), "public/assets/yelo-coffee-mascot.png")),
  ]);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#F7F1E7", color: INK, fontFamily: "IBMPlexSansThai" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40 }}>
        {/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain <img> with an embedded data URL; next/image doesn't work here. */}
        <img src={`data:image/png;base64,${logo.toString("base64")}`} width={84} height={84} alt="" style={{ borderRadius: 20 }} />
        YELO Coffee
      </div>
      <div style={{ marginTop: 40, fontSize: 68, lineHeight: 1.25, display: "flex", flexDirection: "column" }}>
        <span>ระบบ POS ร้านกาแฟ</span>
        <span style={{ color: DEFAULT_ACCENT }}>พร้อมบัตรสะสมแต้มบน LINE</span>
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: "#817668" }}>ขายบนแท็บเล็ต · พร้อมเพย์ QR · รายงานยอดขาย</div>
    </div>,
    { ...size, fonts: [{ name: "IBMPlexSansThai", data: font, weight: 700, style: "normal" }] },
  );
}
