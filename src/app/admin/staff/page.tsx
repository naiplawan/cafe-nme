import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { AddStaffForm, StaffRow } from "./forms";
import { AdminPageHeader } from "../_components/page-header";

export default async function StaffPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") {
    return <div className="rounded-2xl border border-destructive/20 bg-card p-6"><Badge variant="destructive">ไม่มีสิทธิ์</Badge><p className="mt-2 text-sm text-muted-foreground">ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการเพื่อจัดการพนักงาน</p></div>;
  }
  const rows = await db.select({ id: staff.id, name: staff.name, role: staff.role, hasPin: staff.pinHash, isActive: staff.isActive })
    .from(staff).where(eq(staff.shopId, session.shopId)).orderBy(staff.createdAt);
  return <div className="space-y-6">
    <AdminPageHeader section="ทีม" title="พนักงาน" description="จัดการบทบาทและ PIN สำหรับเข้าใช้งาน POS" />
    {rows.some((row) => row.role === "owner" && row.hasPin === null) && <div role="status" className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-base font-semibold text-foreground">ตั้ง PIN เพื่อเข้าหน้าขาย POS</div>}
    <AddStaffForm />
    <section aria-label="รายชื่อพนักงาน">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ชื่อ</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">บทบาท</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">PIN</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">สถานะ</TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{rows.map((row) => <StaffRow key={row.id} currentStaffId={session.staff.id} row={{ ...row, hasPin: row.hasPin !== null }} />)}</TableBody>
        </Table>
      </div>
    </section>
  </div>;
}
