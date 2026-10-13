import type { ChartDatum } from "@/components/charts";

const bangkokDateLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });

export function dailyChartData(days: { date: string; netSatang: number }[], from: string, to: string): ChartDatum[] {
  const salesByDate = new Map(days.map((day) => [day.date, day.netSatang]));
  const date = new Date(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const data: ChartDatum[] = [];

  while (date.getTime() <= end) {
    const dateKey = date.toISOString().slice(0, 10);
    data.push({ label: bangkokDateLabel.format(date), value: salesByDate.get(dateKey) ?? 0 });
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return data;
}

export function bangkokHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
}

export function hourlyChartData(
  hours: { hour: number; netSatang: number }[],
  currentHour: number,
  isToday: boolean,
): { data: ChartDatum[]; highlightLast: boolean } {
  const highlightLast = isToday && currentHour >= 6 && currentHour <= 21;
  const lastHour = highlightLast ? currentHour : 21;
  const salesByHour = new Map(hours.map((entry) => [entry.hour, entry.netSatang]));
  const data = Array.from({ length: lastHour - 5 }, (_, index) => {
    const hour = index + 6;
    return { label: `${String(hour).padStart(2, "0")}:00`, value: salesByHour.get(hour) ?? 0 };
  });

  return { data, highlightLast };
}
