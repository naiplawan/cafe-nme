import { sign, unsign } from "@/lib/signing";

const PURPOSE = "member-qr";
const WINDOW_SECONDS = 60;

export function createMemberToken(memberId: string, now = new Date()): string {
  const window = Math.floor(now.getTime() / 1000 / WINDOW_SECONDS);
  const signed = sign(`${memberId}.${window}`, PURPOSE);
  const mac = signed.slice(signed.lastIndexOf(".") + 1);
  return `CM1.${memberId}.${window}.${mac}`;
}

export function verifyMemberToken(token: string, now = new Date()): string | null {
  const match = /^CM1\.([^.]+)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return null;
  const [, memberId, windowText, mac] = match;
  const window = Number(windowText);
  const currentWindow = Math.floor(now.getTime() / 1000 / WINDOW_SECONDS);
  if (!Number.isSafeInteger(window) || (window !== currentWindow && window !== currentWindow - 1)) return null;
  return unsign(`${memberId}.${window}.${mac}`, PURPOSE) === `${memberId}.${window}` ? memberId : null;
}
