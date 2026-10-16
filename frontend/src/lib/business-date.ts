const DEFAULT_TIME_ZONE = "Asia/Bangkok";

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function businessDate(at: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = partsAt(at, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localMidnight(date: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError("Invalid business date");
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError("Invalid business date");
  }

  let instant = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = partsAt(new Date(instant), timeZone);
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const difference = target - represented;
    instant += difference;
    if (difference === 0) break;
  }
  return new Date(instant);
}

export function businessDayRange(date: string, timeZone = DEFAULT_TIME_ZONE): { start: Date; end: Date } {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: localMidnight(date, timeZone),
    end: localMidnight(
      `${nextDate.getUTCFullYear().toString().padStart(4, "0")}-${(nextDate.getUTCMonth() + 1).toString().padStart(2, "0")}-${nextDate.getUTCDate().toString().padStart(2, "0")}`,
      timeZone,
    ),
  };
}
