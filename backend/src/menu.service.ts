import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TransactionSql } from 'postgres';
import { DatabaseService } from './database.service.js';
import { MenuAvailabilityService } from './menu-availability.service.js';
import { MenuStockService } from './menu-stock.service.js';
import { clearExpiredSoldOut } from './sold-out.js';
import { parseName, parseProduct, record, parseIdList } from './menu-input.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MenuService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MenuAvailabilityService) private readonly availability: MenuAvailabilityService,
    @Inject(MenuStockService) private readonly stock: MenuStockService,
  ) {}

  async getMenu(shopId: string) {
    const db = this.database.connection;
    await clearExpiredSoldOut(db, shopId);
    const [categories, products, modifierGroups, [settings]] = await Promise.all([
      db`select id::text as id, shop_id::text as "shopId", name, sort
         from categories where shop_id = ${shopId}::uuid order by sort asc, name asc`,
      db`select p.id::text as id, p.name, p.base_price_satang as "basePriceSatang",
            p.image_url as "imageUrl", p.tile_color as "tileColor", p.is_active as "isActive", p.sold_out as "soldOut",
            p.earns_stamp as "earnsStamp", p.category_id::text as "categoryId", c.name as "categoryName"
         from products p left join categories c on c.id = p.category_id and c.shop_id = ${shopId}::uuid
         where p.shop_id = ${shopId}::uuid
         order by coalesce(c.sort, 2147483647), p.sort asc, p.name asc`,
      db`select mg.id::text as id, mg.name, mg.min_select as "minSelect", mg.max_select as "maxSelect",
            coalesce(array_agg(m.name order by m.sort) filter (where m.name is not null), '{}') as "modifierNames"
         from modifier_groups mg left join modifiers m on m.group_id = mg.id
         where mg.shop_id = ${shopId}::uuid
         group by mg.id order by mg.sort asc, mg.name asc`,
      db`select auto_clear_sold_out as "autoClearSoldOut" from shops where id = ${shopId}::uuid`,
    ]);
    return { categories, products, modifierGroups, settings: settings ?? { autoClearSoldOut: true } };
  }

  updateSettings(shopId: string, value: unknown) {
    return this.availability.updateSettings(shopId, value);
  }

  async getProduct(shopId: string, productId: string) {
    const db = this.database.connection;
    const [rows, links] = await Promise.all([
      db`select id::text as id, shop_id::text as "shopId", category_id::text as "categoryId",
            name, base_price_satang as "basePriceSatang", image_url as "imageUrl", tile_color as "tileColor", is_active as "isActive",
            sold_out as "soldOut", earns_stamp as "earnsStamp", sort, created_at as "createdAt"
         from products where id = ${productId}::uuid and shop_id = ${shopId}::uuid limit 1`,
      db`select pmg.group_id::text as "groupId" from product_modifier_groups pmg
         join products p on p.id = pmg.product_id and p.shop_id = ${shopId}::uuid
         join modifier_groups mg on mg.id = pmg.group_id and mg.shop_id = ${shopId}::uuid
         where pmg.product_id = ${productId}::uuid order by pmg.sort`,
    ]);
    if (!rows[0]) throw new NotFoundException('Product not found');
    return { ...rows[0], modifierGroupIds: links.map((link) => link.groupId) };
  }

  toggleProductSoldOut(shopId: string, productId: string) {
    return this.availability.toggleProductSoldOut(shopId, productId);
  }

  async createCategory(shopId: string, value: unknown) {
    const name = parseName(record(value).name);
    const db = this.database.connection;
    const result = await db.begin(async (tx) => {
      const existing =
        await tx`select id from categories where shop_id = ${shopId}::uuid and lower(name) = lower(${name}) limit 1`;
      if (existing.length) throw new ConflictException('Category already exists');
      const [sortRow] =
        await tx`select coalesce(max(sort), -1) + 1 as sort from categories where shop_id = ${shopId}::uuid`;
      const [created] = await tx`insert into categories (shop_id, name, sort)
        values (${shopId}::uuid, ${name}, ${sortRow.sort})
        returning id::text as id, shop_id::text as "shopId", name, sort`;
      return created;
    });
    return [result];
  }

  async renameCategory(shopId: string, categoryId: string, value: unknown) {
    const name = parseName(record(value).name);
    const db = this.database.connection;
    const [updated] = await db.begin(async (tx) => {
      const duplicate = await tx`select id from categories where shop_id = ${shopId}::uuid
        and lower(name) = lower(${name}) and id <> ${categoryId}::uuid limit 1`;
      if (duplicate.length) throw new ConflictException('Category already exists');
      return tx`update categories set name = ${name}
        where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid
        returning id::text as id, shop_id::text as "shopId", name, sort`;
    });
    if (!updated) throw new NotFoundException('Category not found');
    return [updated];
  }

  async reorderCategories(shopId: string, value: unknown) {
    const ids = parseIdList(record(value).categoryIds, 'categoryIds');
    return this.reorder(shopId, ids, 'categories');
  }

  async reorderProducts(shopId: string, value: unknown) {
    const ids = parseIdList(record(value).productIds, 'productIds');
    return this.reorder(shopId, ids, 'products');
  }

  /** Rewrites sort to the given order; the list must name every row the shop has, so no row is left unordered. */
  private async reorder(shopId: string, ids: string[], table: 'categories' | 'products') {
    const db = this.database.connection;
    return db.begin(async (tx) => {
      const rows =
        table === 'categories'
          ? await tx`select id::text as id from categories where shop_id = ${shopId}::uuid for update`
          : await tx`select id::text as id from products where shop_id = ${shopId}::uuid for update`;
      const existing = new Set(rows.map((row) => row.id));
      if (existing.size !== ids.length || ids.some((id) => !existing.has(id))) {
        throw new ConflictException('The order must include every item exactly once; reload and try again');
      }
      return table === 'categories'
        ? tx`update categories c set sort = o.ordinality - 1
            from unnest(${ids}::uuid[]) with ordinality as o(id, ordinality)
            where c.id = o.id and c.shop_id = ${shopId}::uuid returning c.id::text as id`
        : tx`update products p set sort = o.ordinality - 1
            from unnest(${ids}::uuid[]) with ordinality as o(id, ordinality)
            where p.id = o.id and p.shop_id = ${shopId}::uuid returning p.id::text as id`;
    });
  }

  async deleteCategory(shopId: string, categoryId: string) {
    const [deleted] = await this.database.connection`
      delete from categories where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid returning id::text as id`;
    if (!deleted) throw new NotFoundException('Category not found');
    return [deleted];
  }

  async createProduct(shopId: string, value: unknown) {
    const input = parseProduct(value);
    const db = this.database.connection;
    return db.begin(async (tx) => {
      await this.assertCategory(tx, shopId, input.categoryId);
      await this.assertModifierGroups(tx, shopId, input.modifierGroupIds);
      const [sortRow] =
        await tx`select coalesce(max(sort), -1) + 1 as sort from products where shop_id = ${shopId}::uuid`;
      const [product] =
        await tx`insert into products (shop_id, category_id, name, base_price_satang, image_url, tile_color, earns_stamp, is_active, sort)
        values (${shopId}::uuid, ${input.categoryId}::uuid, ${input.name}, ${input.price}, ${input.imageUrl}, ${input.tileColor}, ${input.earnsStamp}, ${input.isActive}, ${sortRow.sort})
        returning id::text as id, shop_id::text as "shopId", category_id::text as "categoryId", name,
          base_price_satang as "basePriceSatang", image_url as "imageUrl", tile_color as "tileColor", is_active as "isActive",
          sold_out as "soldOut", earns_stamp as "earnsStamp", sort, created_at as "createdAt"`;
      if (input.modifierGroupIds.length) {
        await tx`insert into product_modifier_groups (product_id, group_id, sort)
          select ${product.id}::uuid, ids.group_id::uuid, ids.ordinality - 1
          from unnest(${input.modifierGroupIds}::text[]) with ordinality as ids(group_id, ordinality)`;
      }
      return [product];
    });
  }

  async updateProduct(shopId: string, productId: string, value: unknown) {
    const input = parseProduct(value);
    const db = this.database.connection;
    return db.begin(async (tx) => {
      const [product] =
        await tx`select id from products where id = ${productId}::uuid and shop_id = ${shopId}::uuid for update`;
      if (!product) throw new NotFoundException('Product not found');
      await this.assertCategory(tx, shopId, input.categoryId);
      await this.assertModifierGroups(tx, shopId, input.modifierGroupIds);
      await tx`update products set category_id = ${input.categoryId}::uuid, name = ${input.name},
        base_price_satang = ${input.price}, image_url = ${input.imageUrl}, tile_color = ${input.tileColor}, earns_stamp = ${input.earnsStamp},
        is_active = ${input.isActive} where id = ${productId}::uuid and shop_id = ${shopId}::uuid`;
      await tx`delete from product_modifier_groups where product_id = ${productId}::uuid`;
      if (input.modifierGroupIds.length) {
        await tx`insert into product_modifier_groups (product_id, group_id, sort)
          select ${productId}::uuid, ids.group_id::uuid, ids.ordinality - 1
          from unnest(${input.modifierGroupIds}::text[]) with ordinality as ids(group_id, ordinality)`;
      }
      return [{ id: productId }];
    });
  }

  async deleteProduct(shopId: string, productId: string) {
    const [deleted] = await this.database.connection`
      delete from products where id = ${productId}::uuid and shop_id = ${shopId}::uuid returning id::text as id`;
    if (!deleted) throw new NotFoundException('Product not found');
    return [deleted];
  }

  async bulkUpdateProducts(shopId: string, value: unknown) {
    const body = record(value);
    if (
      !Array.isArray(body.productIds) ||
      body.productIds.length < 1 ||
      body.productIds.length > 200 ||
      body.productIds.some((id) => typeof id !== 'string' || !UUID.test(id))
    ) {
      throw new BadRequestException('Product ids must contain 1 to 200 valid ids');
    }
    const productIds = [...new Set(body.productIds as string[])];
    if (body.restoreForSale === true) {
      const updated = await this.database.connection`
        update products set is_active = true, sold_out = false, sold_out_on = null
        where shop_id = ${shopId}::uuid and id = any(${productIds}::uuid[]) returning id::text as id`;
      return updated;
    }
    if (body.modifierGroupAction !== undefined) {
      return this.bulkUpdateModifierGroup(shopId, productIds, body.modifierGroupAction, body.modifierGroupId);
    }
    if (typeof body.isActive !== 'boolean' || body.restoreForSale !== undefined) {
      throw new BadRequestException('Provide isActive or restoreForSale=true');
    }
    const updated = await this.database.connection`
      update products set is_active = ${body.isActive}
      where shop_id = ${shopId}::uuid and id = any(${productIds}::uuid[]) returning id::text as id`;
    return updated;
  }

  private async bulkUpdateModifierGroup(shopId: string, productIds: string[], action: unknown, groupId: unknown) {
    if ((action !== 'add' && action !== 'remove') || typeof groupId !== 'string' || !UUID.test(groupId)) {
      throw new BadRequestException('Provide modifierGroupAction add or remove with a valid modifierGroupId');
    }
    const db = this.database.connection;
    return db.begin(async (tx) => {
      await this.assertModifierGroups(tx, shopId, [groupId]);
      if (action === 'remove') {
        return tx`delete from product_modifier_groups pmg using products p
          where pmg.product_id = p.id and p.shop_id = ${shopId}::uuid and p.id = any(${productIds}::uuid[])
            and pmg.group_id = ${groupId}::uuid
          returning pmg.product_id::text as id`;
      }
      // Append after the product's existing groups; products that already have it are left as they are.
      return tx`insert into product_modifier_groups (product_id, group_id, sort)
        select p.id, ${groupId}::uuid,
          coalesce((select max(x.sort) + 1 from product_modifier_groups x where x.product_id = p.id), 0)
        from products p where p.shop_id = ${shopId}::uuid and p.id = any(${productIds}::uuid[])
        on conflict (product_id, group_id) do nothing
        returning product_id::text as id`;
    });
  }

  importStock(shopId: string) {
    return this.stock.importStock(shopId);
  }

  clearSoldOut(shopId: string) {
    return this.availability.clearSoldOut(shopId);
  }

  private async assertCategory(tx: TransactionSql, shopId: string, categoryId: string | null) {
    if (categoryId === null) return;
    const rows =
      await tx`select id from categories where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid limit 1`;
    if (!rows.length) throw new BadRequestException('Category does not belong to this shop');
  }

  private async assertModifierGroups(tx: TransactionSql, shopId: string, groupIds: string[]) {
    if (!groupIds.length) return;
    const rows =
      await tx`select id from modifier_groups where shop_id = ${shopId}::uuid and id = any(${groupIds}::uuid[])`;
    if (rows.length !== groupIds.length) throw new BadRequestException('Modifier group does not belong to this shop');
  }
}
