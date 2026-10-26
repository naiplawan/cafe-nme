"use client";

import { BarChart, ChartCard, CountUp, DonutChart, HBarList, type ChartDatum } from "@/components/charts";
import { formatBaht } from "@/lib/money";

type TodaySummaryData = {
  orders: number;
  netSatang: number;
  cups: number;
  byMethod: { cash: number; promptpay: number };
};

type Props = {
  summary: TodaySummaryData;
  hourlySales: { hour: number; orders: number; netSatang: number }[];
  topItems: { name: string; qty: number }[];
  currentHour: number;
};

const paymentColors = ["#4A2C1A", "#B88A5A"];

export function TodaySummary({ summary, hourlySales, topItems, currentHour }: Props) {
  const currentHourInRange = currentHour >= 6 && currentHour <= 21;
  const lastHour = currentHourInRange ? currentHour : 21;
  const hourlyData: ChartDatum[] = hourlySales
    .filter(({ hour }) => hour >= 6 && hour <= lastHour)
    .map(({ hour, orders }) => ({ label: String(hour).padStart(2, "0"), value: orders }));
  const averageSatang = summary.orders > 0 ? Math.round(summary.netSatang / summary.orders) : 0;
  const itemsData: ChartDatum[] = topItems.map(({ name, qty }) => ({ label: name, value: qty }));
  const paymentData = [
    { label: "เงินสด", value: summary.byMethod.cash, color: paymentColors[0] },
    { label: "พร้อมเพย์", value: summary.byMethod.promptpay, color: paymentColors[1] },
  ];
  const stats = [
    { label: "ยอดขายสุทธิ", value: summary.netSatang, format: "baht" as const, note: "บาท" },
    { label: "ออเดอร์", value: summary.orders, format: "number" as const, note: "บิล" },
    { label: "แก้ว", value: summary.cups, format: "number" as const, note: "แก้ว" },
    { label: "เฉลี่ยต่อบิล", value: averageSatang, format: "baht" as const, note: "บาท" },
  ];

  return <section aria-label="สรุปวันนี้" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
    <h2 className="sr-only">สรุปวันนี้</h2>
    <div className="grid shrink-0 grid-cols-4 gap-3 max-[760px]:grid-cols-2">
      {stats.map((stat) => <article key={stat.label} className="flex min-h-[92px] flex-col justify-center rounded-2xl border border-[#E2D8C7] bg-[#FFFFFF] px-4 py-3">
        <p className="m-0 text-sm font-medium text-[#6B5E55]">{stat.label}</p>
        <p className="m-0 mt-1 flex items-baseline gap-1 text-[26px] font-bold leading-tight text-[#4A2C1A]">
          <CountUp value={stat.value} format={stat.format} />
          <span className="text-sm font-medium text-[#6B5E55]">{stat.note}</span>
        </p>
      </article>)}
    </div>

    <ChartCard title="ออเดอร์ตามช่วงเวลา" subtitle="จำนวนบิลที่ชำระแล้ว · วันนี้">
      <BarChart data={hourlyData} format="number" ariaLabel="จำนวนออเดอร์ที่ชำระแล้วแยกตามชั่วโมงวันนี้" height={178} highlightLast={currentHourInRange} />
    </ChartCard>

    <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 max-[760px]:grid-cols-1">
      <ChartCard title="เมนูขายดี 5 อันดับ" subtitle="เรียงตามจำนวนแก้ว">
        <HBarList data={itemsData} format="number" ariaLabel="เมนูขายดีห้าอันดับวันนี้ เรียงตามจำนวนแก้ว" limit={5} />
      </ChartCard>
      <ChartCard title="ช่องทางชำระเงิน" subtitle="ยอดรับชำระวันนี้">
        <DonutChart
          data={paymentData}
          format="baht"
          ariaLabel="ยอดชำระแยกตามช่องทาง เงินสดและพร้อมเพย์วันนี้"
          size={150}
          centerLabel="ยอดสุทธิ"
          centerValue={formatBaht(summary.netSatang)}
        />
      </ChartCard>
    </div>
  </section>;
}
