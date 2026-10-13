import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("PIN must be 4 to 6 digits");
  const salt = randomBytes(16);
  const hash = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const [algorithm, saltEncoded, hashEncoded, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltEncoded || !hashEncoded || extra !== undefined) return false;

  try {
    const salt = Buffer.from(saltEncoded, "base64");
    const expected = Buffer.from(hashEncoded, "base64");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = (await scrypt(pin, salt, expected.length)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
