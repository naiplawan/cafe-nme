import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getPosMenu } from "@/server/catalog";
import { getAdminDashboardData, getShopProfile } from "@/server/admin-data";
import { publicMenuQr } from "@/server/trial-checkout";
import { AdminAccessDenied } from "../_components/access-denied";
import { AdminPageHeader } from "../_components/page-header";
import { TrialForm } from "./trial-form";
export const instant = false;
export default async function SetupPage() {
  const session = await requireStaff();
  const trialId = `trial-checkout-${session.shopId}`;
  if (session.staff.role === "barista") { return <AdminAccessDenied message="เฉพาะเจ้าของร้านหรือผู้จัดการที่ทดลองออกบิลได้" />; }
  const [menu, profile, dashboard] = await Promise.all([getPosMenu(session.shopId), getShopProfile(session.shopId), getAdminDashboardData(session.shopId)]);
  const qr = profile ? await publicMenuQr(profile.slug).catch(() => null) : null;
  return <div className="max-w-4xl space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="เตรียมร้านและทดลองออกบิล" description="ตรวจสอบร้านก่อนเริ่มขายจริง และเตรียม QR เมนูให้ลูกค้า" />
    <nav aria-label="ขั้นตอนเตรียมร้าน" className="flex flex-wrap gap-4 rounded-xl border p-4"><Link href="/admin/menu">1. เมนู</Link><Link href="/admin/devices">2. อุปกรณ์ POS</Link>{session.staff.role === "owner" ? <Link href="/admin/payment">3. พร้อมเพย์</Link> : <span>3. ให้เจ้าของตั้งค่าพร้อมเพย์</span>}<Link href="/admin/line">4. LINE</Link><a href={`#${trialId}`}>5. ทดลองออกบิล</a></nav>
    <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="text-xl font-semibold">QR เมนูสาธารณะ</h2><p>ลูกค้าเปิดเมนูได้ทันที ไม่ต้องล็อกอินหรือเชื่อมต่อ LINE</p>
      {profile ? <Link href={`/menu/${encodeURIComponent(profile.slug)}`} target="_blank" rel="noopener noreferrer" className="inline-block underline">เปิดเมนูของร้าน</Link> : null}
      {qr ? <div className="flex flex-wrap items-center gap-5"><Image src={qr.image} alt="QR เปิดเมนูของร้าน" width={256} height={256} unoptimized /><div className="space-y-3"><p className="break-all text-sm">{qr.url}</p><a href={qr.image} download={`menu-${profile?.slug}.png`} className="inline-flex min-h-12 items-center rounded-xl border px-5">ดาวน์โหลด QR เมนู</a></div></div> : <p className="text-sm text-muted-foreground">ยังไม่มีที่อยู่เว็บสำหรับสร้าง QR กรุณาติดต่อผู้ดูแลระบบ</p>}
    </section>
    <div id={trialId} className="space-y-3">{dashboard.trialSetup ? <p className="text-green-700">ร้านนี้ผ่านการทดลองออกบิลแล้ว สามารถทดลองซ้ำได้โดยไม่บันทึกยอดขาย</p> : null}<TrialForm menu={menu} /></div>
    <Link href="/admin" className="inline-block underline">กลับภาพรวมร้าน</Link>
  </div>;
}
