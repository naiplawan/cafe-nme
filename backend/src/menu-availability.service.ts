import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { record } from './menu-input.js';

@Injectable()
export class MenuAvailabilityService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async updateSettings(shopId: string, value: unknown) {
    const body = record(value);
    if (typeof body.autoClearSoldOut !== 'boolean') throw new BadRequestException('autoClearSoldOut must be a boolean');
    const [settings] = await this.database.connection`
      update shops set auto_clear_sold_out = ${body.autoClearSoldOut}
      where id = ${shopId}::uuid returning auto_clear_sold_out as "autoClearSoldOut"`;
    if (!settings) throw new NotFoundException('Shop not found');
    return settings;
  }

  async toggleProductSoldOut(shopId: string, productId: string) {
    // Record the business day it sold out so auto-clear can reopen it tomorrow.
    const [product] = await this.database.connection<{ soldOut: boolean }[]>`
      update products p set sold_out = not p.sold_out,
        sold_out_on = case when p.sold_out then null else to_char(now() at time zone s.timezone, 'YYYY-MM-DD') end
      from shops s
      where p.id = ${productId}::uuid and p.shop_id = ${shopId}::uuid and s.id = p.shop_id
      returning p.sold_out as "soldOut"
    `;
    return product ?? null;
  }

  async clearSoldOut(shopId: string) {
    const updated = await this.database.connection`
      update products set sold_out = false, sold_out_on = null
      where shop_id = ${shopId}::uuid and sold_out = true returning id::text as id`;
    return updated;
  }
}
