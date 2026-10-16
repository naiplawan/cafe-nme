const orderTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatOrderTime(date: Date): string {
  return orderTimeFormat.format(date);
}
