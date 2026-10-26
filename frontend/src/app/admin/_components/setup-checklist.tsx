import { Check } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SetupStepKey = "menu" | "modifiers" | "ownerPin" | "device" | "line" | "brand" | "promptpay" | "trial";

const setupSteps: { key: SetupStepKey; title: string; description: string; href: string; action: string; optional?: boolean }[] = [
  { key: "menu", title: "เพิ่มเมนู", description: "เพิ่มเมนูที่เปิดขายอย่างน้อย 1 รายการ", href: "/admin/menu", action: "จัดการเมนู" },
  { key: "modifiers", title: "ตัวเลือกเสริม", description: "เพิ่มกลุ่มตัวเลือกพร้อมตัวเลือกอย่างน้อย 1 รายการ", href: "/admin/modifiers", action: "ตั้งค่าตัวเลือก" },
  { key: "ownerPin", title: "ตั้ง PIN เจ้าของร้าน", description: "ใช้ PIN สำหรับเข้าใช้งานหน้าขาย", href: "/admin/staff", action: "ตั้งค่า PIN" },
  { key: "device", title: "จับคู่แท็บเล็ต POS", description: "เชื่อมต่อแท็บเล็ตสำหรับรับออเดอร์", href: "/admin/devices", action: "จับคู่อุปกรณ์" },
  { key: "promptpay", title: "ตั้งค่าพร้อมเพย์", description: "ลงทะเบียนหมายเลขรับเงิน บันทึก และตรวจชื่อผู้รับจาก QR 1 บาท", href: "/admin/payment", action: "ตั้งค่าพร้อมเพย์", optional: true },
  { key: "line", title: "เชื่อมต่อ LINE", description: "ตั้งค่า LINE เพื่อให้สมาชิกใช้บัตรสะสมแต้ม", href: "/admin/line", action: "ตั้งค่า LINE" },
  { key: "trial", title: "ทดลองออกบิล", description: "ทดสอบรับชำระโดยไม่บันทึกยอดขายหรือเปลี่ยนสต็อก", href: "/admin/setup", action: "ทดลองออกบิล" },
  { key: "brand", title: "ตั้งค่าแบรนด์", description: "เพิ่มโลโก้หรือสีประจำร้าน", href: "/admin/brand", action: "ตั้งค่าแบรนด์", optional: true },

];

export type AdminSetupRole = "owner" | "manager" | "barista";

export function setupStepKeysForRole(role: AdminSetupRole): SetupStepKey[] {
  if (role === "barista") return ["menu", "modifiers"];
  return setupSteps.filter(({ key }) => role === "owner" || key !== "promptpay").map(({ key }) => key);
}

export function SetupChecklist({ steps, role }: { steps: Record<SetupStepKey, boolean>; role: AdminSetupRole }) {
  const visibleKeys = new Set(setupStepKeysForRole(role));
  const visibleSteps = setupSteps.filter(({ key }) => visibleKeys.has(key));
  const requiredSteps = visibleSteps.filter(({ optional }) => !optional);
  const completedCount = requiredSteps.filter(({ key }) => steps[key]).length;

  // Optional steps (brand) must not keep the checklist on screen forever.
  if (requiredSteps.every(({ key }) => steps[key])) return null;
  // Remaining steps first; finished ones collapse to a single compact row.
  const ordered = [...visibleSteps].sort((a, b) => Number(steps[a.key]) - Number(steps[b.key]));

  return (
    <Card className="overflow-hidden border-primary/20 bg-card">
      <CardHeader className="pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">เริ่มต้นใช้งานร้าน</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">ทำตามขั้นตอนเพื่อเตรียมร้านให้พร้อมใช้งาน</p>
        </div>
        <p className="mt-2 w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-secondary-foreground sm:mt-0">
          {completedCount}/{requiredSteps.length}
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map(({ key, title, description, href, action, optional }) => {
          const done = steps[key];

          if (done) return (
            <Link key={key} href={href} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2F6B3F] text-white"><Check aria-hidden="true" className="size-4" /></span>
              <span className="min-w-0 flex-1 truncate"><span className="sr-only">เสร็จแล้ว: </span>{title}</span>
              <span className="text-xs">ดู</span>
            </Link>
          );

          return (
            <div key={key} className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${done ? "border-[#2F6B3F] bg-[#2F6B3F] text-white" : "border-border text-transparent"}`}
              >
                <span className="sr-only">{done ? "เสร็จแล้ว" : "ยังไม่เสร็จ"}</span>
                {done && <Check aria-hidden="true" className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {title}{optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">ไม่บังคับ</span>}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
                <Link href={href} className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {done ? "ดูการตั้งค่า" : action}
                </Link>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
