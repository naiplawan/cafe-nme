import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { listAdminDevices } from "@/server/pos-session";
import { AddDeviceForm, DeviceActions } from "./forms";
import { AdminPageHeader } from "../_components/page-header";
import { AdminAccessDenied } from "../_components/access-denied";

const lastSeenFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function DevicesPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") {
    return <AdminAccessDenied message="ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการเพื่อจัดการเครื่อง POS" />;
  }
  const devices = await listAdminDevices(session.shopId, session.staff.id);
  return <div className="space-y-6">
    <AdminPageHeader section="อุปกรณ์" title="เครื่อง POS" description="สถานะจับคู่และเวลาที่เครื่องติดต่อระบบล่าสุด" />
    <AddDeviceForm />
    {devices.length > 0 ? <section aria-label="รายการเครื่อง POS" className="grid gap-4 xl:grid-cols-2">{devices.map((device) => <Card key={device.id}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0"><CardTitle className="truncate">{device.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">ติดต่อระบบล่าสุด:</span> {device.lastSeenAt ? lastSeenFormat.format(device.lastSeenAt) : "ยังไม่มีประวัติใช้งาน"}</p></div>
        <Badge variant={device.paired ? "secondary" : "outline"}>{device.paired ? "จับคู่แล้ว" : "ยังไม่จับคู่"}</Badge>
      </CardHeader>
      <CardContent><DeviceActions deviceId={device.id} /></CardContent>
    </Card>)}</section> : <Card><CardContent className="py-10 text-center"><p className="font-medium">ยังไม่มีเครื่อง POS</p><p className="mt-1 text-sm text-muted-foreground">เพิ่มเครื่อง POS เพื่อเริ่มจับคู่กับแท็บเล็ตหน้าร้าน</p></CardContent></Card>}
  </div>;
}
