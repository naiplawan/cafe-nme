import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

const PROMPTPAY_ID = /^(0\d{9}|\d{13})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PaymentSettingsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private async requireOwner(shopId: string, actorStaffId: unknown): Promise<void> {
    if (typeof actorStaffId !== "string" || !UUID.test(actorStaffId)) {
      throw new BadRequestException("actorStaffId is invalid");
    }
    const [owner] = await this.database.connection<{ id: string }[]>`
      select id::text as id from staff
      where id = ${actorStaffId}::uuid and shop_id = ${shopId}::uuid
        and role = 'owner' and is_active = true
      limit 1`;
    if (!owner) throw new ForbiddenException("Only an active shop owner can manage PromptPay settings");
  }

  async getPromptPayId(shopId: string, actorStaffId: string): Promise<{ promptpayId: string | null }> {
    await this.requireOwner(shopId, actorStaffId);
    const [shop] = await this.database.connection<{ promptpayId: string | null }[]>`
      select promptpay_id as "promptpayId" from shops where id = ${shopId}::uuid limit 1`;
    return { promptpayId: shop?.promptpayId ?? null };
  }

  async savePromptPayId(shopId: string, actorStaffId: string, promptpayId: unknown): Promise<{ success: true }> {
    await this.requireOwner(shopId, actorStaffId);
    if (promptpayId !== null && typeof promptpayId !== "string") {
      throw new BadRequestException("PromptPay ID is invalid");
    }
    const normalized = typeof promptpayId === "string"
      ? promptpayId.replace(/[\s-]/g, "")
      : null;
    if (normalized !== null && !PROMPTPAY_ID.test(normalized)) {
      throw new BadRequestException("PromptPay ID must be a 10-digit mobile number or a 13-digit ID");
    }
    await this.database.connection`
      update shops set promptpay_id = ${normalized}
      where id = ${shopId}::uuid`;
    return { success: true };
  }
}
