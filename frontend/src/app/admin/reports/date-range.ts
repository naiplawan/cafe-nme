const DAY_MS = 86_400_000;

function dateEpoch(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const epoch = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value ? epoch : null;
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dateRangeValid(from: string, to: string): boolean {
  const start = dateEpoch(from);
  const end = dateEpoch(to);
  return start !== null && end !== null && end >= start && (end - start) / DAY_MS < 365;
}

export function resolveReportDateRange(requestedFrom: string | undefined, requestedTo: string | undefined, today: string) {
  const range = { from: requestedFrom ?? today, to: requestedTo ?? today };
  const start = dateEpoch(range.from);
  const end = dateEpoch(range.to);
  if (start === null || end === null) {
    return { range, error: "กรุณาเลือกวันที่ที่ถูกต้อง" };
  }
  if (end < start) {
    return { range, error: "วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด" };
  }
  if ((end - start) / DAY_MS >= 365) {
    return { range, error: "เลือกช่วงเวลาไม่เกิน 365 วัน" };
  }
  return { range, error: null };
}
