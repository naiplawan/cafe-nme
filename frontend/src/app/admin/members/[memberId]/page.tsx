import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { getMemberSummary, listLedger } from "@/server/loyalty";
import { AdjustStampsForm, DeleteMemberForm } from "../forms";
import { AdminPageHeader } from "../../_components/page-header";

const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const ledgerLabels: Record<string, string> = {
  earn: "รับแสตมป์",
  redeem: "แลกรางวัล",
  expire: "แสตมป์หมดอายุ",
  adjust: "ปรับยอด",
};

export default async function MemberDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { shopId, staff } = await requireStaff();
  const { memberId } = await params;
  const [member, ledger] = await Promise.all([
    getMemberSummary(shopId, memberId),
    listLedger(shopId, memberId, 50),
  ]);
  if (!member) notFound();
  const canManage = staff.role === "owner" || staff.role === "manager";

  return (
    <div className="space-y-6">
      <Link href="/admin/members" className={buttonVariants({ variant: "link", className: "h-auto p-0" })}><ArrowLeft aria-hidden="true" size={16} /> กลับไปหน้าสมาชิก</Link>
      <AdminPageHeader section="สมาชิก" title={member.displayName} description="ข้อมูลสมาชิก ยอดแสตมป์ และประวัติการใช้งาน" action={member.lineLinked ? <Badge variant="secondary">เชื่อมต่อ LINE แล้ว</Badge> : <Badge variant="outline">ยังไม่เชื่อมต่อ LINE</Badge>} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardTitle>ข้อมูลสมาชิก</CardTitle></CardHeader><CardContent className="space-y-2">
          <p>เบอร์โทร: {member.phone ?? "—"}</p>
          <p>แสตมป์คงเหลือ: <span className="font-semibold">{member.stampBalance}</span> / {member.stampGoal}</p>
          <p>รางวัลพร้อมใช้: {member.availableRewards.length}</p>
        </CardContent></Card>
        {canManage && <Card><CardHeader><CardTitle>ปรับแสตมป์</CardTitle></CardHeader><CardContent><AdjustStampsForm memberId={member.id} currentBalance={member.stampBalance} /></CardContent></Card>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ประวัติแสตมป์</h2>
        <Card><CardContent className="p-0">
          <div className="divide-y sm:hidden">
            {ledger.length > 0 ? ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0"><p className="font-medium">{ledgerLabels[entry.reason] ?? entry.reason}</p><p className="text-xs text-muted-foreground">{dateFormat.format(entry.createdAt)}{entry.orderId ? ` · ออเดอร์ ${entry.orderId.slice(0, 8)}` : ""}</p></div>
              <p className={`shrink-0 font-semibold tabular-nums ${entry.delta > 0 ? "text-emerald-700" : "text-destructive"}`}>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</p>
            </div>) : <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีประวัติแสตมป์</p>}
          </div>
          <div className="hidden overflow-x-auto sm:block"><Table>
            <TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead>รายการ</TableHead><TableHead>จำนวน</TableHead><TableHead>ออเดอร์</TableHead></TableRow></TableHeader>
            <TableBody>{ledger.length > 0 ? ledger.map((entry) => <TableRow key={entry.id}>
              <TableCell>{dateFormat.format(entry.createdAt)}</TableCell>
              <TableCell>{ledgerLabels[entry.reason] ?? entry.reason}</TableCell>
              <TableCell className={entry.delta > 0 ? "text-emerald-700" : "text-destructive"}>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</TableCell>
              <TableCell>{entry.orderId ? entry.orderId.slice(0, 8) : "—"}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">ยังไม่มีประวัติแสตมป์</TableCell></TableRow>}</TableBody>
          </Table></div>
        </CardContent></Card>
      </section>

      {canManage && <Card className="border-destructive/40"><CardHeader><CardTitle className="text-destructive">ลบข้อมูลส่วนบุคคล</CardTitle></CardHeader><CardContent><DeleteMemberForm memberId={member.id} /></CardContent></Card>}
    </div>
  );
}
