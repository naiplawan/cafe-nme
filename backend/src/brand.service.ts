import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

const LOGO_MAX_BYTES = 300 * 1024;
const MAX_BASE64_BYTES = Math.ceil(LOGO_MAX_BYTES / 3) * 4;
const ACCENT = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_PREFIX = /^#/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type LogoMime = "image/png" | "image/jpeg" | "image/webp";

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") {
    throw new BadRequestException("รหัสสีไม่ถูกต้อง");
  }
  const input = value.trim();
  if (!ACCENT.test(input)) {
    throw new BadRequestException("รหัสสีไม่ถูกต้อง");
  }
  const raw = input.replace(HEX_PREFIX, "");
  return `#${raw.length === 3 ? [...raw].map((char) => char + char).join("") : raw}`.toUpperCase();
}

function sniffImageMime(bytes: Uint8Array): LogoMime | null {
  const at = (index: number, ...values: number[]) => values.every((value, offset) => bytes[index + offset] === value);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png";
  }
  if (at(0, 0xff, 0xd8, 0xff)) {
    return "image/jpeg";
  }
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) {
    return "image/webp";
  }
  return null;
}

@Injectable()
export class BrandService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getBrand(shopId: string) {
    const [row] = await this.database.connection`
      select accent, logo_mime as "logoMime", updated_at as "updatedAt"
      from shop_brands where shop_id = ${shopId}::uuid limit 1`;
    const hasLogo = Boolean(row?.logoMime);
    return {
      accent: row?.accent ?? null,
      hasCustomAccent: Boolean(row?.accent),
      logoUpdatedAt: hasLogo && row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  async getLogo(shopId: string) {
    const [row] = await this.database.connection`
      select logo, logo_mime as "logoMime", updated_at as "updatedAt"
      from shop_brands where shop_id = ${shopId}::uuid limit 1`;
    if (!row?.logo || !row.logoMime) {
      return null;
    }
    return {
      bytes: Buffer.from(row.logo as Uint8Array),
      mime: row.logoMime as LogoMime,
      updatedAt: new Date(row.updatedAt),
    };
  }

  async saveAccent(shopId: string, value: unknown) {
    if (value !== null && value !== "") {
      const accent = normalizeHex(value);
      await this.database.connection`
        insert into shop_brands (shop_id, accent, updated_at)
        values (${shopId}::uuid, ${accent}, now())
        on conflict (shop_id) do update set accent = excluded.accent, updated_at = excluded.updated_at`;
      return;
    }
    await this.database.connection`
      insert into shop_brands (shop_id, accent, updated_at)
      values (${shopId}::uuid, null, now())
      on conflict (shop_id) do update set accent = null, updated_at = excluded.updated_at`;
  }

  async saveLogo(shopId: string, encoded: string) {
    if (!encoded) {
      throw new BadRequestException("กรุณาเลือกไฟล์โลโก้");
    }
    if (Buffer.byteLength(encoded, "ascii") > MAX_BASE64_BYTES || !BASE64.test(encoded)) {
      throw new BadRequestException("รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP");
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.byteLength === 0) {
      throw new BadRequestException("กรุณาเลือกไฟล์โลโก้");
    }
    if (bytes.byteLength > LOGO_MAX_BYTES || bytes.toString("base64") !== encoded) {
      throw new BadRequestException("ไฟล์โลโก้ใหญ่เกิน 300 KB");
    }
    const mime = sniffImageMime(bytes);
    if (!mime) {
      throw new BadRequestException("รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP");
    }
    await this.database.connection`
      insert into shop_brands (shop_id, logo, logo_mime, updated_at)
      values (${shopId}::uuid, ${bytes}, ${mime}, now())
      on conflict (shop_id) do update
      set logo = excluded.logo, logo_mime = excluded.logo_mime, updated_at = excluded.updated_at`;
  }

  async removeLogo(shopId: string) {
    await this.database.connection`
      insert into shop_brands (shop_id, logo, logo_mime, updated_at)
      values (${shopId}::uuid, null, null, now())
      on conflict (shop_id) do update
      set logo = null, logo_mime = null, updated_at = excluded.updated_at`;
  }
}
