// Thai leading vowels are written before the consonant they follow in speech,
// so "เจ้าของร้าน" should show "จ", not "เ", as its avatar initial.
const LEADING_VOWELS = /^[เแโใไ]+/;
const HONORIFICS = /^(คุณ|พี่|น้อง)\s*/;

/** First meaningful letter of a name for avatars and placeholder tiles. */
export function thaiInitial(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(HONORIFICS, "").replace(LEADING_VOWELS, "");
  return Array.from(stripped || trimmed)[0]?.toUpperCase() ?? "?";
}

/** "0814821000" → "081-xxx-1000"; anything that isn't a 10-digit Thai number stays as given. */
export function maskPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `${digits.slice(0, 3)}-xxx-${digits.slice(6)}` : phone;
}
