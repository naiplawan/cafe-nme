export function projectedStampBalance(currentBalance: number, rawDelta: string): number | null {
  if (!rawDelta.trim()) return null;
  const delta = Number(rawDelta);
  if (!Number.isSafeInteger(delta) || delta === 0) return null;
  return currentBalance + delta;
}
