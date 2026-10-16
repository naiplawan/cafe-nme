import "server-only";
import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { getShopProfile } from "@/server/admin-data";
import { getLineConfig } from "@/server/line";
import { LineConfigForm } from "./forms";
import { AdminPageHeader } from "../_components/page-header";
import { AdminAccessDenied } from "../_components/access-denied";

export default async function LineAdminPage() {
  const session = await requireStaff();
  if (session.staff.role === "barista") return <AdminAccessDenied message="ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการเพื่อตั้งค่าการเชื่อมต่อ LINE" />;
  const [[config, shop], requestHeaders] = await Promise.all([
    Promise.all([
      getLineConfig(session.shopId),
      getShopProfile(session.shopId),
    ]),
    headers(),
  ]).then(([rows, headerList]) => [rows, headerList] as const);
  const origin = requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;
  return <section className="space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="เชื่อมต่อ LINE" description="ตั้งค่าช่องทาง Messaging API, LINE Login และ LIFF ของร้าน" />
    <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm shadow-sm sm:p-6">
      <h2 className="font-semibold">ขั้นตอนตั้งค่า</h2>
      <ol className="grid list-none gap-3 p-0 text-muted-foreground sm:grid-cols-2">
        {[
          "สร้าง Provider ใน LINE Developers Console",
          "สร้าง Messaging API channel และนำ Channel ID, secret, access token มากรอก",
          "สร้าง LINE Login channel ใน Provider เดียวกัน แล้วสร้าง LIFF app ขนาด Full พร้อม scopes openid และ profile",
          "นำ LINE Login Channel ID และ LIFF ID มากรอก แล้วตั้งค่า Webhook URL ใน Messaging API channel",
        ].map((step, index) => <li key={step} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">{index + 1}</span><span className="leading-6">{step}</span></li>)}
      </ol>
    </div>
    <LineConfigForm config={{
      messagingChannelId: config.messagingChannelId,
      loginChannelId: config.loginChannelId,
      liffId: config.liffId,
      secretSet: Boolean(config.channelSecret),
      tokenSet: Boolean(config.accessToken),
      richMenuSet: Boolean(config.richMenuId),
    }} webhookUrl={`${origin}/api/line/webhook/${session.shopId}`} liffUrl={`${origin}/liff/${shop?.slug ?? ""}`} />
  </section>;
}
