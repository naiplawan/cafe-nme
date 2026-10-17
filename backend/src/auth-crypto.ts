import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const PASSWORD_HASH_PATTERN = /^[a-f0-9]{128}$/i;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !PASSWORD_HASH_PATTERN.test(expectedHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
