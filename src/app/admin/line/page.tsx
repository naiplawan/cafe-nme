import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLineConfig } from "@/server/line";
import { LineConfigForm } from "./forms";
import { AdminPageHeader } from "../_components/page-header";

export default async function LineAdminPage() {
  const session = await requireStaff();
  if (session.staff.role === "barista") return <p>ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
  const [[config, shop], requestHeaders] = await Promise.all([
    Promise.all([
      getLineConfig(session.shopId),
      db.select({ slug: shops.slug }).from(shops).where(eq(shops.id, session.shopId)).limit(1),
    ]),
    headers(),
  ]).then(([rows, headerList]) => [rows, headerList] as const);
  const origin = requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;
  return <section className="space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="เชื่อมต่อ LINE" description="ตั้งค่าช่องทาง Messaging API, LINE Login และ LIFF ของร้าน" />
    <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm shadow-sm sm:p-6">
      <h2 className="font-semibold">ขั้นตอนตั้งค่า</h2>
      <ol className="grid gap-2 text-muted-foreground sm:grid-cols-2">
        <li>สร้าง Provider ใน LINE Developers Console</li>
        <li>สร้าง Messaging API channel และนำ Channel ID, secret, access token มากรอก</li>
        <li>สร้าง LINE Login channel ใน Provider เดียวกัน แล้วสร้าง LIFF app ขนาด Full พร้อม scopes openid และ profile</li>
        <li>นำ LINE Login Channel ID และ LIFF ID มากรอก แล้วตั้งค่า Webhook URL ใน Messaging API channel</li>
      </ol>
    </div>
    <LineConfigForm config={{
      messagingChannelId: config.messagingChannelId,
      loginChannelId: config.loginChannelId,
      liffId: config.liffId,
      secretSet: Boolean(config.channelSecret),
      tokenSet: Boolean(config.accessToken),
      richMenuSet: Boolean(config.richMenuId),
    }} webhookUrl={`${origin}/api/line/webhook/${session.shopId}`} liffUrl={`${origin}/liff/${shop[0]?.slug ?? ""}`} />
  </section>;
}
