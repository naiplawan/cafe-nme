import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC signing for small values (POS session cookies, member QR tokens).
// `purpose` separates keys so a token made for one use can't be replayed as another.

function key(purpose: string, secret = process.env.APP_SECRET): Buffer {
  if (!secret || secret.length < 32) throw new Error("APP_SECRET must be set (32+ chars)");
  return createHmac("sha256", secret).update(`cafe-pos:${purpose}`).digest();
}

export function sign(value: string, purpose: string, secret?: string): string {
  const mac = createHmac("sha256", key(purpose, secret)).update(value).digest("base64url");
  return `${value}.${mac}`;
}

/** Returns the original value if the signature is valid, otherwise null. */
export function unsign(signed: string, purpose: string, secret?: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const expected = Buffer.from(sign(value, purpose, secret).slice(dot + 1));
  const actual = Buffer.from(signed.slice(dot + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return value;
}
