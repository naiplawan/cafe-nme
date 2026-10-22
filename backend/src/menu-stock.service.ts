import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { STOCK_GROUPS, STOCK_MENU } from './stock-menu.js';

@Injectable()
export class MenuStockService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async importStock(shopId: string) {
    const db = this.database.connection;
    return db.begin(async (tx) => {
      const categories = await tx`select id::text as id, name, sort from categories where shop_id = ${shopId}::uuid`;
      const categoryIds = new Map(categories.map((row) => [row.name, row.id]));
      let categorySort = Math.max(-1, ...categories.map((row) => Number(row.sort))) + 1;
      for (const name of new Set(STOCK_MENU.map((item) => item[2]))) {
        if (categoryIds.has(name)) continue;
        const [created] = await tx`insert into categories (shop_id, name, sort)
          values (${shopId}::uuid, ${name}, ${categorySort++}) returning id::text as id`;
        categoryIds.set(name, created.id);
      }
      const existing = await tx`select name from products where shop_id = ${shopId}::uuid`;
      const existingNames = new Set(existing.map((row) => row.name));
      const groups = await tx`select id::text as id, name from modifier_groups
        where shop_id = ${shopId}::uuid order by sort, name`;
      const groupIds = new Map<string, string>();
      for (const group of groups) if (!groupIds.has(group.name)) groupIds.set(group.name, group.id);
      const [maxRow] =
        await tx`select coalesce(max(sort), -1) + 1 as sort from products where shop_id = ${shopId}::uuid`;
      let sort = Number(maxRow.sort);
      let added = 0;
      let linkedProducts = 0;
      for (const [slug, name, category, price, kind] of STOCK_MENU) {
        if (existingNames.has(name)) continue;
        const [product] = await tx`insert into products
          (shop_id, category_id, name, base_price_satang, image_url, earns_stamp, is_active, sort)
          values (${shopId}::uuid, ${categoryIds.get(category)}::uuid, ${name}, ${price}, ${`/api/menu-assets/menu/${slug}.webp`}, ${kind !== 'bakery'}, true, ${sort++})
          returning id::text as id`;
        const links = STOCK_GROUPS[kind].flatMap((groupName) => {
          const id = groupIds.get(groupName);
          return id ? [id] : [];
        });
        if (links.length) {
          linkedProducts += 1;
          await tx`insert into product_modifier_groups (product_id, group_id, sort)
            select ${product.id}::uuid, ids.group_id::uuid, ids.ordinality - 1
            from unnest(${links}::text[]) with ordinality as ids(group_id, ordinality)`;
        }
        added += 1;
      }
      return { added, linkedProducts };
    });
  }
}
