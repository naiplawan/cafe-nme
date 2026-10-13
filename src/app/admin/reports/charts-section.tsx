import { AreaChart, BarChart, ChartCard, DonutChart, HBarList, type ChartDatum } from "@/components/charts";

type ReportsChartsProps = {
  dailySales: ChartDatum[];
  hourlySales: ChartDatum[];
  highlightLastHour: boolean;
  showHourly: boolean;
  categories: ChartDatum[];
  topItems: ChartDatum[];
  paymentMethods: ChartDatum[];
  memberOrders: number;
  totalOrders: number;
  stampsIssued: number;
  rewardsRedeemed: number;
};

const percentFormat = new Intl.NumberFormat("th-TH", { style: "percent", maximumFractionDigits: 0 });

export function ReportsCharts({
  dailySales,
  hourlySales,
  highlightLastHour,
  showHourly,
  categories,
  topItems,
  paymentMethods,
  memberOrders,
  totalOrders,
  stampsIssued,
  rewardsRedeemed,
}: ReportsChartsProps) {
  const memberPercent = totalOrders > 0 ? memberOrders / totalOrders : 0;

  return (
    <section aria-label="กราฟสรุปรายงาน" className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* The time series gets two columns so a month of days stays readable. */}
      <div className="min-w-0 md:col-span-2">
        <ChartCard title={showHourly ? "ยอดขายรายชั่วโมง" : "ยอดขายรายวัน"}>
          {showHourly
            ? <BarChart data={hourlySales} format="baht" ariaLabel="ยอดขายรายชั่วโมง หน่วยบาท" highlightLast={highlightLastHour} />
            : <AreaChart data={dailySales} format="baht" ariaLabel="ยอดขายรายวัน หน่วยบาท" />}
        </ChartCard>
      </div>

      <ChartCard title="ยอดขายตามหมวดหมู่">
        <DonutChart data={categories} format="baht" ariaLabel="ยอดขายสุทธิตามหมวดหมู่ หน่วยบาท" />
      </ChartCard>

      <ChartCard title="เมนูขายดี">
        <HBarList data={topItems} format="baht" ariaLabel="เมนูขายดี 8 อันดับตามยอดขาย หน่วยบาท" limit={8} />
      </ChartCard>

      <ChartCard title="ช่องทางชำระเงิน">
        <DonutChart data={paymentMethods} format="baht" ariaLabel="ยอดชำระเงินสดและ PromptPay หน่วยบาท" />
      </ChartCard>

      <ChartCard title="ลูกค้าสมาชิก" subtitle="สัดส่วนออเดอร์ที่ใช้สมาชิก">
        <DonutChart
          data={[
            { label: "ออเดอร์สมาชิก", value: memberOrders },
            { label: "ออเดอร์ทั่วไป", value: Math.max(0, totalOrders - memberOrders) },
          ]}
          format="number"
          ariaLabel="สัดส่วนออเดอร์สมาชิกต่อออเดอร์ทั้งหมด"
          size={128}
          centerLabel="ออเดอร์สมาชิก"
          centerValue={percentFormat.format(memberPercent)}
        />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          <div>
            <p className="text-muted-foreground">แสตมป์ที่ออก</p>
            <p className="mt-1 font-semibold tabular-nums">{new Intl.NumberFormat("th-TH").format(stampsIssued)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">รางวัลที่แลก</p>
            <p className="mt-1 font-semibold tabular-nums">{new Intl.NumberFormat("th-TH").format(rewardsRedeemed)}</p>
          </div>
        </div>
      </ChartCard>
    </section>
  );
}
