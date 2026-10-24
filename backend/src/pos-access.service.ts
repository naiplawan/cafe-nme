import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseService } from "./database.service.js";
import { isPairingCode } from "./pos-pairing.js";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newPairingCode = () => randomInt(0, 100_000_000).toString().padStart(8, "0");

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const [algorithm, saltEncoded, hashEncoded, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltEncoded || !hashEncoded || extra !== undefined) return false;
  try {
    const salt = Buffer.from(saltEncoded, "base64");
    const expected = Buffer.from(hashEncoded, "base64");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(pin, salt, expected.length) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

@Injectable()
export class PosAccessService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async createDevice(shopId: string, actorStaffId: string, name: string) {
    await this.requireAdmin(shopId, actorStaffId);
    const code = newPairingCode();
    const [device] = await this.database.connection<{ id: string }[]>`
      insert into pos_devices (shop_id, name, pairing_code_hash, pairing_expires_at)
      values (${shopId}::uuid, ${name}, ${sha256(code)}, now() + interval '10 minutes')
      returning id::text as id
    `;
    return { deviceId: device.id, pairingCode: code };
  }

  async regeneratePairingCode(shopId: string, actorStaffId: string, deviceId: string) {
    await this.requireAdmin(shopId, actorStaffId);
    const code = newPairingCode();
    const rows = await this.database.connection<{ id: string }[]>`
      update pos_devices set pairing_code_hash = ${sha256(code)}, pairing_expires_at = now() + interval '10 minutes'
      where shop_id = ${shopId}::uuid and id = ${deviceId}::uuid returning id::text as id
    `;
    if (!rows.length) throw new NotFoundException("POS device not found");
    return { pairingCode: code };
  }

  async removeDevice(shopId: string, actorStaffId: string, deviceId: string) {
    await this.requireAdmin(shopId, actorStaffId);
    await this.database.connection`
      delete from pos_devices where shop_id = ${shopId}::uuid and id = ${deviceId}::uuid
    `;
    return { ok: true as const };
  }

  async listDevices(shopId: string, actorStaffId: string) {
    await this.requireAdmin(shopId, actorStaffId);
    return this.database.connection<{
      id: string; name: string; paired: boolean; lastSeenAt: Date | null;
    }[]>`
      select id::text as id, name, device_token_hash is not null as paired, last_seen_at as "lastSeenAt"
      from pos_devices where shop_id = ${shopId}::uuid order by created_at
    `;
  }

  async pairDevice(code: string) {
    if (!isPairingCode(code)) return null;
    const deviceToken = randomBytes(32).toString("base64url");
    const [device] = await this.database.connection<{
      deviceId: string; deviceName: string; shopId: string;
    }[]>`
      update pos_devices set device_token_hash = ${sha256(deviceToken)},
        pairing_code_hash = null, pairing_expires_at = null
      where pairing_code_hash = ${sha256(code)} and pairing_expires_at > now()
      returning id::text as "deviceId", name as "deviceName", shop_id::text as "shopId"
    `;
    if (!device) return null;
    const [shop] = await this.database.connection<{
      id: string; name: string; promptpayId: string | null; stampGoal: number; receiptFooter: string | null;
    }[]>`
      select id::text as id, name, promptpay_id as "promptpayId", stamp_goal as "stampGoal", receipt_footer as "receiptFooter"
      from shops where id = ${device.shopId}::uuid limit 1
    `;
    if (!shop) return null;
    return { deviceId: device.deviceId, deviceName: device.deviceName, deviceToken, shop };
  }

  async getDevice(token: string) {
    const [row] = await this.database.connection<{
      deviceId: string; deviceName: string; shopId: string; shopName: string;
      promptpayId: string | null; stampGoal: number; receiptFooter: string | null;
    }[]>`
      update pos_devices d set last_seen_at = now()
      from shops s
      where d.shop_id = s.id and d.device_token_hash = ${sha256(token)}
      returning d.id::text as "deviceId", d.name as "deviceName", s.id::text as "shopId",
        s.name as "shopName", s.promptpay_id as "promptpayId", s.stamp_goal as "stampGoal",
        s.receipt_footer as "receiptFooter"
    `;
    if (!row) return null;
    return {
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      shop: { id: row.shopId, name: row.shopName, promptpayId: row.promptpayId, stampGoal: row.stampGoal, receiptFooter: row.receiptFooter },
    };
  }

  async listPosStaff(shopId: string, deviceToken: string) {
    if (!await this.getDeviceWithoutTouch(deviceToken, shopId)) return null;
    return this.database.connection<{ id: string; name: string; role: string; hasPin: boolean }[]>`
      select id::text as id, name, role, pin_hash is not null as "hasPin"
      from staff where shop_id = ${shopId}::uuid and is_active = true order by created_at
    `;
  }

  async loginStaff(shopId: string, deviceToken: string, staffId: string, pin: string) {
    const device = await this.getDeviceWithoutTouch(deviceToken, shopId);
    if (!device) return null;
    const [record] = await this.database.connection<{ id: string; pinHash: string | null }[]>`
      select id::text as id, pin_hash as "pinHash" from staff
      where shop_id = ${shopId}::uuid and id = ${staffId}::uuid and is_active = true limit 1
    `;
    if (!record?.pinHash || !(await verifyPin(pin, record.pinHash))) return null;
    return { staffId: record.id, deviceId: device.deviceId, shopId: device.shopId };
  }

  async getActiveStaff(shopId: string, staffId: string) {
    const [record] = await this.database.connection<{ id: string; name: string; role: "owner" | "manager" | "barista" }[]>`
      select id::text as id, name, role from staff
      where shop_id = ${shopId}::uuid and id = ${staffId}::uuid and is_active = true limit 1
    `;
    return record ?? null;
  }

  async verifyManagerPin(shopId: string, actorStaffId: string, pin: string) {
    const [actor] = await this.database.connection<{ id: string }[]>`
      select id::text as id from staff
      where shop_id = ${shopId}::uuid and id = ${actorStaffId}::uuid and is_active = true limit 1
    `;
    if (!actor) return null;
    const rows = await this.database.connection<{ id: string; role: string; pinHash: string }[]>`
      select id::text as id, role, pin_hash as "pinHash" from staff
      where shop_id = ${shopId}::uuid and is_active = true and pin_hash is not null
    `;
    for (const row of rows) {
      if ((row.role === "owner" || row.role === "manager") && await verifyPin(pin, row.pinHash)) {
        return { staffId: row.id };
      }
    }
    return null;
  }

  async listStaff(shopId: string, actorStaffId: string) {
    await this.requireAdmin(shopId, actorStaffId);
    return this.database.connection<{
      id: string; name: string; role: "owner" | "manager" | "barista"; hasPin: boolean; isActive: boolean;
    }[]>`
      select id::text as id, name, role, pin_hash is not null as "hasPin", is_active as "isActive"
      from staff where shop_id = ${shopId}::uuid order by created_at
    `;
  }

  async createStaff(shopId: string, actorStaffId: string, input: { name: string; role: string; pin: string }) {
    const actor = await this.requireAdmin(shopId, actorStaffId);
    if (actor.role === "manager" && input.role === "owner") throw new ForbiddenException("Cannot create a higher role");
    const pinHash = await hashPin(input.pin);
    const [staff] = await this.database.connection<{ id: string }[]>`
      insert into staff (shop_id, name, role, pin_hash)
      values (${shopId}::uuid, ${input.name}, ${input.role}, ${pinHash}) returning id::text as id
    `;
    return { id: staff.id };
  }

  async setStaffPin(shopId: string, actorStaffId: string, staffId: string, pin: string) {
    const actor = await this.requireAdmin(shopId, actorStaffId);
    const [target] = await this.database.connection<{ role: string }[]>`
      select role from staff where shop_id = ${shopId}::uuid and id = ${staffId}::uuid limit 1
    `;
    if (!target) throw new NotFoundException("Staff not found");
    if (actor.role === "manager" && target.role === "owner") throw new ForbiddenException("Cannot change a higher role");
    const result = await this.database.connection<{ id: string }[]>`
      update staff set pin_hash = ${await hashPin(pin)}
      where shop_id = ${shopId}::uuid and id = ${staffId}::uuid returning id::text as id
    `;
    if (!result.length) throw new NotFoundException("Staff not found");
    return { id: staffId };
  }

  async setStaffActive(shopId: string, actorStaffId: string, staffId: string, active: boolean) {
    const actor = await this.requireAdmin(shopId, actorStaffId);
    const [target] = await this.database.connection<{ role: string }[]>`
      select role from staff where shop_id = ${shopId}::uuid and id = ${staffId}::uuid limit 1
    `;
    if (!target) throw new NotFoundException("Staff not found");
    if (actor.role === "manager" && target.role === "owner") throw new ForbiddenException("Cannot change a higher role");
    if (!active) {
      if (actorStaffId === staffId || target.role === "owner") throw new ConflictException("Cannot disable this account");
    }
    const result = await this.database.connection<{ id: string }[]>`
      update staff set is_active = ${active}
      where shop_id = ${shopId}::uuid and id = ${staffId}::uuid returning id::text as id
    `;
    if (!result.length) throw new NotFoundException("Staff not found");
    return { id: staffId };
  }

  private async requireAdmin(shopId: string, actorStaffId: string) {
    const [actor] = await this.database.connection<{ role: string }[]>`
      select role from staff where shop_id = ${shopId}::uuid and id = ${actorStaffId}::uuid and is_active = true limit 1
    `;
    if (!actor || (actor.role !== "owner" && actor.role !== "manager")) throw new NotFoundException("Staff not found");
    return actor;
  }

  private async getDeviceWithoutTouch(token: string, shopId: string) {
    const [device] = await this.database.connection<{ deviceId: string; shopId: string }[]>`
      select d.id::text as "deviceId", s.id::text as "shopId"
      from pos_devices d join shops s on s.id = d.shop_id
      where d.shop_id = ${shopId}::uuid and d.device_token_hash = ${sha256(token)} limit 1
    `;
    return device ?? null;
  }
}
