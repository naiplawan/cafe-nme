import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { onAccent } from "@/lib/brand";
import { getBrand, getLogo } from "@/server/brand";

export const RICH_MENU_LABELS = ["บัตรสมาชิก", "แต้มของฉัน", "เมนู", "สมัครสมาชิก", "ร้านของเรา", "ติดต่อร้าน"] as const;

const cream = "#FFF6E5";
const ink = "#1E1A17";
const fontPromise = readFile(join(process.cwd(), "src/server/fonts/IBMPlexSansThai-Bold.ttf"));

function MenuIcon({ kind, color }: { kind: number; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons = [
    <><rect x="35" y="55" width="180" height="140" rx="18" {...common} /><path d="M35 95h180M65 155h48" {...common} /></>,
    <><path d="M125 35 148 55l30-3 10 29 25 17-10 29 10 29-25 17-10 29-30-3-23 20-23-20-30 3-10-29-25-17 10-29-10-29 25-17 10-29 30 3z" {...common} /><path d="m90 128 22 22 49-53" {...common} /></>,
    <><path d="M50 100h130v60a50 50 0 0 1-50 50h-30a50 50 0 0 1-50-50z M180 118h14a26 26 0 0 1 0 52h-14 M40 225h160" {...common} /><path d="M90 40c-12 14 12 26 0 40M125 40c-12 14 12 26 0 40M160 40c-12 14 12 26 0 40" {...common} /></>,
    <><circle cx="105" cy="85" r="42" {...common} /><path d="M35 205c8-39 34-59 70-59 19 0 35 5 47 16m34-9v57m-28-28h56" {...common} /></>,
    <><path d="m35 104 90-67 90 67v104H35V104zM92 208v-63h66v63M25 108h200" {...common} /><path d="M73 101V72h30v29m43 0V72h30v29" {...common} /></>,
    <><path d="M35 48h180v128H112l-48 38v-38H35V48z" {...common} /><path d="M75 112h2m47 0h2m47 0h2" {...common} /></>,
  ];
  return <svg aria-hidden="true" width="250" height="250" viewBox="0 0 250 250">{icons[kind]}</svg>;
}

export async function renderRichMenuPng(shopId: string): Promise<Buffer> {
  const [brand, logo, fontBytes] = await Promise.all([getBrand(shopId), getLogo(shopId), fontPromise]);
  const logoSrc = logo ? `data:${logo.mime};base64,${logo.bytes.toString("base64")}` : null;
  const response = new ImageResponse(
    <div style={{ width: 2500, height: 1686, display: "flex", flexDirection: "column", fontFamily: "IBMPlexSansThai" }}>
      {[0, 1].map((row) => <div key={row} style={{ width: 2500, height: 843, display: "flex", flexDirection: "row" }}>
        {[0, 1, 2].map((column) => {
          const index = row * 3 + column;
          const accented = (row + column) % 2 === 0;
          const color = accented ? onAccent(brand.accent) : ink;
          return <div key={index} style={{ width: column === 2 ? 834 : 833, height: 843, backgroundColor: accented ? brand.accent : cream,
            color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
            {index === 0 && logoSrc
              // eslint-disable-next-line @next/next/no-img-element -- ImageResponse accepts embedded data URLs directly.
              ? <img src={logoSrc} alt="" width={260} height={260} style={{ objectFit: "contain" }} />
              : <MenuIcon kind={index} color={color} />}
            <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}>{RICH_MENU_LABELS[index]}</div>
          </div>;
        })}
      </div>)}
    </div>,
    { width: 2500, height: 1686, fonts: [{ name: "IBMPlexSansThai", data: new Uint8Array(fontBytes).buffer, weight: 700, style: "normal" }] },
  );
  const png = Buffer.from(await response.arrayBuffer());
  if (png.byteLength >= 1024 * 1024) throw new Error("LINE rich menu image exceeds 1 MB");
  return png;
}
