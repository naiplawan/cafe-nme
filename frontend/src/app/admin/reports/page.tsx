import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { businessDate } from "@/lib/business-date";
import { formatBaht } from "@/lib/money";
import { categorySales, dailySales, hourlySales, refundSummary, salesByItem, salesSummary } from "@/server/reports";
import { AdminPageHeader } from "../_components/page-header";
import { bangkokHour, dailyChartData, hourlyChartData, isSelectedPreset } from "./chart-data";
import { ReportsCharts } from "./charts-section";
import { dateRangeValid, resolveReportDateRange, shiftDate } from "./date-range";

type SearchParams = Promise<{ from?: string | string[]; to?: string | string[] }>;
const percentageFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1, signDisplay: "always" });

function periodChange(current: number, previous: number) {
  if (previous === 0) return "ไม่มีข้อมูลช่วงก่อนหน้า";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const formatted = percentageFormat.format(change);
  return `${formatted}% เทียบช่วงก่อน`;
}

function ReportDateControls({ range, today, error }: { range: { from: string; to: string }; today: string; error?: string }) {
  const controlId = "reports-date-range";
  const periodDays = dateRangeValid(range.from, range.to)
    ? (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 + 1
    : null;
  const previousTo = periodDays ? shiftDate(range.from, -1) : null;
  const previousFrom = periodDays ? shiftDate(range.from, -periodDays) : null;
  const monthStart = `${today.slice(0, 7)}-01`;
  const presetLinks = [
    { label: "วันนี้", from: today, to: today },
    { label: "7 วัน", from: shiftDate(today, -6), to: today },
    { label: "เดือนนี้", from: monthStart, to: today },
  ];

  return <Card><CardContent className="space-y-4 p-4 sm:p-6">
    <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" action="/admin/reports" method="get">
      <label htmlFor={`${controlId}-from`} className="grid min-w-0 gap-1.5 text-sm font-medium">ตั้งแต่<Input id={`${controlId}-from`} type="date" name="from" defaultValue={range.from} required /></label>
      <label htmlFor={`${controlId}-to`} className="grid min-w-0 gap-1.5 text-sm font-medium">ถึงวันที่<Input id={`${controlId}-to`} type="date" name="to" defaultValue={range.to} required /></label>
      <Button type="submit" className="w-full sm:w-auto">ดูรายงาน</Button>
    </form>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <nav className="flex flex-wrap items-center gap-2" aria-label="ช่วงวันที่ด่วน">
      <span className="mr-1 text-sm font-medium">ช่วงด่วน</span>
      {presetLinks.map((preset) => {
        const selected = isSelectedPreset(range, preset);
        return <Link key={preset.label} href={`/admin/reports?from=${preset.from}&to=${preset.to}`} aria-current={selected ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>{preset.label}</Link>;
      })}
    </nav>
    {periodDays && previousFrom && previousTo && !error ? <p className="text-xs leading-5 text-muted-foreground">ตัวเลขหลักเปรียบเทียบกับ {previousFrom} – {previousTo} ({periodDays} วันก่อนหน้า)</p> : null}
  </CardContent></Card>;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { shopId } = await requireStaff();
  const params = await searchParams;
  const today = businessDate(new Date());
  const requestedFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const requestedTo = Array.isArray(params.to) ? params.to[0] : params.to;
  const dateRange = resolveReportDateRange(requestedFrom, requestedTo, today);
  if (dateRange.error) {
    return <div className="space-y-7">
      <AdminPageHeader section="ยอดขาย" title="รายงาน" description="สรุปยอดขาย ออเดอร์ และสมาชิกตามช่วงวันที่" />
      <ReportDateControls range={dateRange.range} today={today} error={dateRange.error} />
    </div>;
  }
  const { range } = dateRange;
  const periodDays = (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 + 1;
  const previousTo = shiftDate(range.from, -1);
  const previousFrom = shiftDate(range.from, -periodDays);
  const [summary, previousSummary, refunds, days, items, hours, categories] = await Promise.all([
    salesSummary(shopId, range.from, range.to),
    salesSummary(shopId, previousFrom, previousTo),
    refundSummary(shopId, range.from, range.to),
    dailySales(shopId, range.from, range.to),
    salesByItem(shopId, range.from, range.to),
    hourlySales(shopId, range.from, range.to),
    categorySales(shopId, range.from, range.to),
  ]);
  const isSingleDay = range.from === range.to;
  const chartDays = dailyChartData(days, range.from, range.to);
  const chartHours = hourlyChartData(hours, bangkokHour(new Date()), range.from === today && range.to === today);
  const statCards = [
    { label: "ยอดขายหลังส่วนลด ก่อนคืนเงิน", value: formatBaht(summary.netSatang), comparison: periodChange(summary.netSatang, previousSummary.netSatang) },
    { label: "ออเดอร์", value: summary.orders, comparison: periodChange(summary.orders, previousSummary.orders) },
    { label: "แก้วที่ขาย", value: summary.cups, comparison: periodChange(summary.cups, previousSummary.cups) },
    { label: "ยอดก่อนหักส่วนลด", value: formatBaht(summary.grossSatang) },
    { label: "ส่วนลด", value: formatBaht(summary.discountSatang) },
    { label: "ออเดอร์ยกเลิก", value: summary.voided },
    { label: "เงินสด", value: formatBaht(summary.byMethod.cash) },
    { label: "PromptPay", value: formatBaht(summary.byMethod.promptpay) },
    { label: "ออเดอร์สมาชิก", value: summary.memberOrders },
    { label: "แสตมป์ที่ออก", value: summary.stampsIssued },
    { label: "รางวัลที่แลก", value: summary.rewardsRedeemed },
    { label: "สมาชิกใหม่", value: summary.newMembers },
  ];

  return (
    <div className="space-y-7">
      <AdminPageHeader section="ยอดขาย" title="รายงาน" description="สรุปยอดขาย ออเดอร์ และสมาชิกตามช่วงวันที่" action={<Link href={`/admin/reports/export?from=${range.from}&to=${range.to}`} className={buttonVariants({ variant: "outline" })}>ดาวน์โหลด CSV</Link>} />

      <ReportDateControls range={range} today={today} />

      <section aria-label="สรุปการคืนเงิน" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "อนุมัติคืนเงิน", value: formatBaht(refunds.approvedSatang), detail: `${refunds.approvedCount} รายการ · วันที่อนุมัติ` },
          { label: "จ่ายคืนแล้ว", value: formatBaht(refunds.paidSatang), detail: `${refunds.paidCount} รายการ · เงินสด ${formatBaht(refunds.cashPaidSatang)} · PromptPay ${formatBaht(refunds.promptpayPaidSatang)}` },
          { label: "อนุมัติแต่ยังไม่จ่าย", value: formatBaht(refunds.unpaidApprovedSatang), detail: "บันทึกอนุมัติแยกจากการโอนหรือจ่ายเงินจริง" },
        ].map((stat) => <Card key={stat.label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-xl font-semibold">{stat.value}</p><p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p></CardContent></Card>)}
      </section>

      <section aria-label="ตัวเลขหลัก" className="grid gap-3 sm:grid-cols-3">
        {statCards.slice(0, 3).map((stat) => <Card key={stat.label}><CardContent className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
          {"comparison" in stat && <p className="mt-1 text-xs text-muted-foreground">{stat.comparison}</p>}
        </CardContent></Card>)}
      </section>
      <section aria-label="รายละเอียดเพิ่มเติม" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.slice(3).map((stat) => <Card key={stat.label}><CardContent className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
          {"comparison" in stat && <p className="mt-1 text-xs text-muted-foreground">{stat.comparison}</p>}
        </CardContent></Card>)}
      </section>

      <ReportsCharts
        dailySales={chartDays}
        hourlySales={chartHours.data}
        highlightLastHour={chartHours.highlightLast}
        showHourly={isSingleDay}
        categories={categories.map((category) => ({ label: category.category, value: category.revenueSatang }))}
        topItems={items.toSorted((a, b) => b.revenueSatang - a.revenueSatang).slice(0, 8).map((item) => ({ label: item.name, value: item.revenueSatang }))}
        paymentMethods={[
          { label: "เงินสด", value: summary.byMethod.cash },
          { label: "PromptPay", value: summary.byMethod.promptpay },
        ]}
        memberOrders={summary.memberOrders}
        totalOrders={summary.orders}
        stampsIssued={summary.stampsIssued}
        rewardsRedeemed={summary.rewardsRedeemed}
      />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ยอดขายรายวัน (ก่อนคืนเงิน)</h2>
        <Card><CardContent className="p-0">
          <div className="divide-y sm:hidden">
            {days.length > 0 ? days.map((day) => <div key={day.date} className="flex items-center justify-between gap-3 p-3">
              <div><p className="font-medium">{day.date}</p><p className="text-sm text-muted-foreground">{day.orders} ออเดอร์</p></div>
              <p className="shrink-0 font-semibold tabular-nums">{formatBaht(day.netSatang)}</p>
            </div>) : <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายการในช่วงวันที่นี้</p>}
          </div>
          <div className="hidden overflow-x-auto sm:block"><Table>
            <TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead>ออเดอร์</TableHead><TableHead className="text-right">ยอดหลังส่วนลด ก่อนคืนเงิน</TableHead></TableRow></TableHeader>
            <TableBody>{days.length > 0 ? days.map((day) => <TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{day.orders}</TableCell><TableCell className="text-right">{formatBaht(day.netSatang)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">ไม่มีรายการในช่วงวันที่นี้</TableCell></TableRow>}</TableBody>
          </Table></div>
        </CardContent></Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">เมนูขายดี</h2>
        <Card><CardContent className="p-0">
          <div className="divide-y sm:hidden">
            {items.length > 0 ? items.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.qty} รายการ</p></div>
              <p className="shrink-0 font-semibold tabular-nums">{formatBaht(item.revenueSatang)}</p>
            </div>) : <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายการในช่วงวันที่นี้</p>}
          </div>
          <div className="hidden overflow-x-auto sm:block"><Table>
            <TableHeader><TableRow><TableHead>เมนู</TableHead><TableHead>จำนวน</TableHead><TableHead className="text-right">ยอดขาย</TableHead></TableRow></TableHeader>
            <TableBody>{items.length > 0 ? items.map((item) => <TableRow key={item.name}><TableCell>{item.name}</TableCell><TableCell>{item.qty}</TableCell><TableCell className="text-right">{formatBaht(item.revenueSatang)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">ไม่มีรายการในช่วงวันที่นี้</TableCell></TableRow>}</TableBody>
          </Table></div>
        </CardContent></Card>
      </section>
    </div>
  );
}
