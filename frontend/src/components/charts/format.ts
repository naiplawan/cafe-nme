import { formatBaht } from "@/lib/money";

export type ChartFormat = "baht" | "number" | "percent";
export type ChartDatum = { label: string; value: number };

const numberFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

export function formatChartValue(value: number, format: ChartFormat = "number"): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (format === "baht") return formatBaht(Math.round(safeValue));
  const formatted = numberFormat.format(safeValue);
  return format === "percent" ? `${formatted}%` : formatted;
}

export function sanitizeValues(values: number[]): number[] {
  return values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
}

export function getNiceTicks(maxValue: number): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 1, 2, 3, 4];
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const factor = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const top = Math.ceil(maxValue / step) * step;
  return Array.from({ length: 5 }, (_, index) => (top / 4) * index);
}

export function thinLabelIndexes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 12) return Array.from({ length: count }, (_, index) => index);
  const stride = Math.ceil((count - 1) / 7);
  const indexes = Array.from({ length: count }, (_, index) => index).filter((index) => index % stride === 0);
  if (indexes[indexes.length - 1] !== count - 1) indexes.push(count - 1);
  return indexes;
}

export function sanitizeData<T extends ChartDatum>(data: T[]): (T & { value: number })[] {
  return data.map((datum) => ({ ...datum, value: Number.isFinite(datum.value) && datum.value > 0 ? datum.value : 0 }));
}

export function isEmptyChart(data: ChartDatum[]): boolean {
  return data.length === 0 || sanitizeData(data).every(({ value }) => value === 0);
}
