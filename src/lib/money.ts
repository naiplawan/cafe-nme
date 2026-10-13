// All money is integer satang (1 baht = 100 satang). Never use floats for totals.

const BAHT_INPUT = /^-?\d+(\.\d{1,2})?$/;

/** Parses user input like "45", "45.5", "1,200.00" into satang. Returns null if invalid. */
export function parseBahtToSatang(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!BAHT_INPUT.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [whole, fraction = ""] = cleaned.replace("-", "").split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -satang : satang;
}

const bahtFormat = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 4550 -> "฿45.5", 4500 -> "฿45" */
export function formatBaht(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  return `${sign}฿${bahtFormat.format(Math.abs(satang) / 100)}`;
}

/** Plain decimal for form inputs: 4550 -> "45.50", 4500 -> "45" */
export function satangToInput(satang: number): string {
  return satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2);
}
