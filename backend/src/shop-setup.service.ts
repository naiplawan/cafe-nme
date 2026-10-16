import { Inject, Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseService } from "./database.service.js";

const scrypt = promisify(scryptCallback);
const PIN_KEY_LENGTH = 64;

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, PIN_KEY_LENGTH) as Buffer;
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export interface ShopSetupInput {
  authUserId: string;
  shopName: string;
  slug: string;
  ownerName: string;
  promptpayId: string | null;
  pin: string;
}

@Injectable()
export class ShopSetupService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async ownerShopExists(authUserId: string): Promise<boolean> {
    const [owner] = await this.database.connection<{ id: string }[]>`
      select id::text as id from staff where auth_user_id = ${authUserId}::uuid limit 1
    `;
    return Boolean(owner);
  }

  async createShop(input: ShopSetupInput): Promise<{ status: "created" | "already_exists" }> {
    return this.database.connection.begin(async (tx) => {
      // Serialize setup attempts for one Supabase identity, including retries from another app instance.
      await tx`select pg_advisory_xact_lock(hashtext(${input.authUserId}))`;
      const [owner] = await tx<{ id: string }[]>`
        select id::text as id from staff where auth_user_id = ${input.authUserId}::uuid limit 1
      `;
      if (owner) {
        return { status: "already_exists" };
      }

      const pinHash = await hashPin(input.pin);
      const [shop] = await tx<{ id: string }[]>`
        insert into shops (name, slug, promptpay_id)
        values (${input.shopName}, ${input.slug}, ${input.promptpayId})
        returning id::text as id
      `;
      await tx`
        insert into staff (shop_id, name, role, auth_user_id, pin_hash)
        values (${shop.id}::uuid, ${input.ownerName}, 'owner', ${input.authUserId}::uuid, ${pinHash})
      `;
      return { status: "created" };
    });
  }
}
