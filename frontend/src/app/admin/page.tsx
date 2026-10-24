import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AreaChart, BarChart, ChartCard, CountUp, DonutChart, HBarList } from "@/components/charts";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { businessDate } from "@/lib/business-date";
import { formatBaht } from "@/lib/money";
import { getAdminDashboardData, getShopProfile } from "@/server/admin-data";
import { getPromptPaySettings } from "@/server/payment-settings";
import { dailySales, hourlySales, salesByItem, salesSummary } from "@/server/reports";
import { AdminPageHeader } from "./_components/page-header";
import { SetupChecklist } from "./_components/setup-checklist";
import { BranchComparison } from "./branch-comparison";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear().toString().padStart(4, "0")}-${(shifted.getUTCMonth() + 1).toString().padStart(2, "0")}-${shifted.getUTCDate().toString().padStart(2, "0")}`;
}

const shortThaiDate = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", timeZone: "Asia/Bangkok" });
const bangkokHourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" });
const percentageFormat = new Intl.NumberFormat("th-TH", { signDisplay: "always", maximumFractionDigits: 1 });

function bangkokHour(at: Date) {
  return Number(bangkokHourFormat.format(at));
}

export default async function AdminDashboardPage() {
  const { shopId, staff: currentStaff, shops } = await requireStaff();
  const now = new Date();
  const today = businessDate(now);
  const weekStart = shiftDate(today, -6);
  const previousWeekStart = shiftDate(weekStart, -7);
  const previousWeekEnd = shiftDate(weekStart, -1);
  const currentHour = bangkokHour(now);
  const promptpaySetupPromise = currentStaff.role === "owner"
    ? getPromptPaySettings(shopId, currentStaff.id).then(({ promptpayId }) => Boolean(promptpayId)).catch(() => false)
    : Promise.resolve(false);
  const [dashboard, todaySales, weeklySales, previousWeeklySales, daily, hourly, items, promptpaySetup, profile] = await Promise.all([
    getAdminDashboardData(shopId),
    salesSummary(shopId, today, today),
    salesSummary(shopId, weekStart, today),
    salesSummary(shopId, previousWeekStart, previousWeekEnd),
    dailySales(shopId, weekStart, today),
    hourlySales(shopId, today, today),
    salesByItem(shopId, weekStart, today),
    promptpaySetupPromise,
    getShopProfile(shopId),
  ]);

  const dailyByDate = new Map(daily.map((day) => [day.date, day.netSatang]));
  const weeklyChart = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart, index);
    return { label: shortThaiDate.format(new Date(`${date}T12:00:00+07:00`)), value: dailyByDate.get(date) ?? 0 };
  });
  const salesChange = previousWeeklySales.netSatang === 0
    ? "ยังไม่มียอดให้เทียบ"
    : `${percentageFormat.format(((weeklySales.netSatang - previousWeeklySales.netSatang) / previousWeeklySales.netSatang) * 100)}%`;
  const salesChangeDirection = weeklySales.netSatang >= previousWeeklySales.netSatang ? "up" : "down";
  const hourlyRange = currentHour >= 6 && currentHour <= 21
    ? hourly.filter(({ hour }) => hour >= 6 && hour <= currentHour)
    : hourly.filter(({ hour }) => hour >= 6 && hour <= 21);

  const stats = [
    { label: "เมนูที่เปิดขาย", value: dashboard.activeProducts, href: "/admin/menu", note: `จากทั้งหมด ${dashboard.allProducts} รายการ` },
    { label: "หมวดหมู่", value: dashboard.categoryCount, href: "/admin/menu", note: "จัดกลุ่มสินค้าให้ค้นหาง่าย" },
    { label: "กลุ่มตัวเลือกเสริม", value: dashboard.groupCount, href: "/admin/modifiers", note: "เช่น ความหวานและประเภทเครื่องดื่ม" },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader section="ร้านของคุณ" title="ภาพรวม" description="ดูสถานะร้านและยอดขายวันนี้ได้จากหน้าเดียว" />

      <SetupChecklist steps={{
        menu: dashboard.activeProducts > 0,
        modifiers: dashboard.modifierSetup > 0,
        ownerPin: dashboard.ownerPinSetup,
        device: dashboard.deviceSetup,
        line: dashboard.lineSetup,
        brand: dashboard.brandSetup,
        promptpay: promptpaySetup,
        trial: dashboard.trialSetup,
      }} role={currentStaff.role} />

      {profile ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="font-semibold">เมนูสำหรับลูกค้า</h2><p className="text-sm text-muted-foreground">เปิดดูเมนูผ่านลิงก์หรือ QR ได้โดยไม่ต้องเชื่อมต่อ LINE</p></div>
        <div className="flex gap-4"><Link href={`/menu/${encodeURIComponent(profile.slug)}`} target="_blank" rel="noopener noreferrer" className="underline">เปิดเมนูสาธารณะ</Link>
          {currentStaff.role !== "barista" ? <Link href="/admin/setup" className="underline">ดาวน์โหลด QR / ทดลองออกบิล</Link> : null}</div>
      </CardContent></Card> : null}

      <section aria-label="สรุปข้อมูลร้าน" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card className="col-span-2 xl:order-last xl:col-span-1">
          <CardContent className="p-3 sm:p-5">
            <p className="text-sm font-medium text-muted-foreground">ยอดขายวันนี้</p>
            <CountUp value={todaySales.netSatang} format="baht" className="mt-2 block text-2xl font-semibold tracking-tight sm:mt-3" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              <span className="whitespace-nowrap">{todaySales.orders} ออเดอร์</span> · <span className="whitespace-nowrap">{todaySales.cups} แก้ว</span> · <span className="whitespace-nowrap">สมาชิก {todaySales.memberOrders} ออเดอร์</span>
            </p>
            <Link href="/admin/reports" className="mt-2 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline sm:mt-3">
              ดูรายงานวันนี้ <ArrowRight aria-hidden="true" size={16} className="ml-1" />
            </Link>
          </CardContent>
        </Card>
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="h-full transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="p-3 sm:p-5">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{stat.note}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <BranchComparison shops={shops} activeShopId={shopId} from={weekStart} to={today} activeWeeklySales={weeklySales} />

      {dashboard.allProducts === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <Image
              src="/assets/empty-orders.png"
              alt="ภาพประกอบร้านที่ยังไม่มีเมนู"
              width={160}
              height={160}
              className="mb-4"
            />
            <h2 className="text-lg font-semibold">เริ่มเพิ่มเมนูแรกของร้าน</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              เพิ่มเครื่องดื่มและตัวเลือกเสริม เพื่อเตรียมร้านให้พร้อมใช้งาน
            </p>
            <Link
              href="/admin/menu"
              className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              ไปจัดการเมนู
            </Link>
          </CardContent>
        </Card>
      )}

      <section aria-label="กราฟยอดขาย" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="ยอดขาย 7 วันล่าสุด" subtitle={`รวม ${formatBaht(weeklySales.netSatang)}`}>
          <p className={`mb-3 text-sm font-medium ${salesChange === "ยังไม่มียอดให้เทียบ" ? "text-muted-foreground" : salesChangeDirection === "up" ? "text-[#2F6B3F]" : "text-[#B4441C]"}`}>
            {salesChange === "ยังไม่มียอดให้เทียบ" ? salesChange : <span className="inline-flex items-center gap-1">{salesChangeDirection === "up" ? <ArrowUp aria-hidden="true" size={16} /> : <ArrowDown aria-hidden="true" size={16} />}{salesChange} เทียบ 7 วันก่อน</span>}
          </p>
          <AreaChart data={weeklyChart} format="baht" ariaLabel="ยอดขายสุทธิรายวัน 7 วันล่าสุด" />
        </ChartCard>
        <ChartCard title="ช่วงเวลาขายดีวันนี้">
          <BarChart
            data={hourlyRange.map(({ hour, orders }) => ({ label: String(hour), value: orders }))}
            ariaLabel="จำนวนออเดอร์แยกตามชั่วโมงวันนี้"
            highlightLast={currentHour >= 6 && currentHour <= 21}
          />
        </ChartCard>
        <ChartCard
          title="เมนูขายดี 7 วัน"
          action={<Link href="/admin/reports" className="text-sm font-medium text-primary underline-offset-4 hover:underline">ดูรายงาน</Link>}
        >
          <HBarList data={items.slice(0, 5).map(({ name, qty }) => ({ label: name, value: qty }))} format="number" ariaLabel="เมนูขายดี 5 อันดับใน 7 วันล่าสุด" limit={5} />
        </ChartCard>
        <ChartCard title="ช่องทางชำระเงิน 7 วัน">
          <DonutChart
            data={[
              { label: "เงินสด", value: weeklySales.byMethod.cash, color: "#3B2A20" },
              { label: "พร้อมเพย์", value: weeklySales.byMethod.promptpay, color: "#C69C72" },
            ]}
            format="baht"
            ariaLabel="ยอดขายแยกตามช่องทางชำระเงิน 7 วันล่าสุด"
            centerLabel="ยอดรวม"
            centerValue={formatBaht(weeklySales.netSatang)}
          />
        </ChartCard>
      </section>
    </div>
  );
}
