import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";

type ProductInput = {
  name: string;
  price: number;
  categoryId: string | null;
  imageUrl: string | null;
  earnsStamp: boolean;
  isActive: boolean;
  modifierGroupIds: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOCK_MENU = [
  ["espresso", "เอสเพรสโซ่", "กาแฟ", 4500, "coffee"],
  ["iced-americano", "อเมริกาโน่เย็น", "กาแฟ", 5500, "coffee"],
  ["cappuccino", "คาปูชิโน่", "กาแฟ", 5500, "coffee"],
  ["iced-mocha", "มอคค่า", "กาแฟ", 6000, "coffee"],
  ["caramel-macchiato", "คาราเมลมัคคิอาโต้", "กาแฟ", 6500, "coffee"],
  ["flat-white", "แฟลตไวท์", "กาแฟ", 6000, "coffee"],
  ["dirty-coffee", "เดอร์ตี้", "กาแฟ", 7000, "coffee"],
  ["coconut-americano", "อเมริกาโน่มะพร้าว", "กาแฟ", 7000, "coffee"],
  ["orange-espresso", "เอสเพรสโซ่ส้ม", "กาแฟ", 7500, "coffee"],
  ["oliang", "โอเลี้ยง", "กาแฟ", 4000, "drink"],
  ["green-milk-tea", "ชาเขียวนม", "ชา", 4500, "milk"],
  ["lemon-tea", "ชามะนาว", "ชา", 4000, "drink"],
  ["matcha-straight", "มัทฉะเพียว", "ชา", 7000, "drink"],
  ["coconut-matcha", "มัทฉะมะพร้าว", "ชา", 7500, "drink"],
  ["hojicha-latte", "โฮจิฉะลาเต้", "ชา", 6500, "milk"],
  ["strawberry-matcha", "มัทฉะสตรอว์เบอร์รี", "ชา", 8000, "milk"],
  ["peach-tea", "ชาพีช", "ชา", 5500, "drink"],
  ["honey-lemon-tea", "ชาน้ำผึ้งมะนาว", "ชา", 5000, "drink"],
  ["cocoa", "โกโก้", "อื่นๆ", 4500, "milk"],
  ["pink-milk", "นมชมพู", "อื่นๆ", 4000, "milk"],
  ["caramel-milk", "นมคาราเมล", "อื่นๆ", 4500, "milk"],
  ["red-lime-soda", "แดงมะนาวโซดา", "อื่นๆ", 4500, "drink"],
  ["mango-smoothie", "มะม่วงปั่น", "อื่นๆ", 6000, "drink"],
  ["butterfly-pea-lemonade", "อัญชันมะนาว", "อื่นๆ", 5000, "drink"],
  ["butter-croissant", "ครัวซองต์เนย", "เบเกอรี่", 5500, "bakery"],
  ["banana-cake", "เค้กกล้วยหอม", "เบเกอรี่", 4500, "bakery"],
  ["brownie", "บราวนี่", "เบเกอรี่", 5500, "bakery"],
  ["thai-tea-crepe-cake", "เครปเค้กชาไทย", "เบเกอรี่", 7500, "bakery"],
  ["thick-toast", "ปังปิ้งเนยนม", "เบเกอรี่", 4500, "bakery"],
  ["cinnamon-roll", "ซินนามอนโรล", "เบเกอรี่", 6000, "bakery"],
] as const;

const STOCK_GROUPS: Record<string, string[]> = {
  coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
  milk: ["ความหวาน", "ประเภท", "นม"],
  drink: ["ความหวาน", "ประเภท"],
  bakery: [],
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function parseName(value: unknown): string {
  if (typeof value !== "string") throw new BadRequestException("Name is required");
  const name = value.trim();
  if (!name || name.length > 80) throw new BadRequestException("Name must be 1 to 80 characters");
  return name;
}

function parseProduct(value: unknown): ProductInput {
  const body = record(value);
  const name = parseName(body.name);
  if (!Number.isSafeInteger(body.price) || (body.price as number) < 0) {
    throw new BadRequestException("Price must be a non-negative integer in satang");
  }
  if (body.categoryId !== null && (typeof body.categoryId !== "string" || !UUID.test(body.categoryId))) {
    throw new BadRequestException("Category id is invalid");
  }
  if (body.imageUrl !== null && typeof body.imageUrl !== "string") {
    throw new BadRequestException("Image URL must be a string or null");
  }
  if (typeof body.earnsStamp !== "boolean" || typeof body.isActive !== "boolean") {
    throw new BadRequestException("Product flags must be booleans");
  }
  if (!Array.isArray(body.modifierGroupIds) || body.modifierGroupIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new BadRequestException("Modifier group ids are invalid");
  }
  if (body.modifierGroupIds.length > 100) throw new BadRequestException("Too many modifier groups");
  return {
    name,
    price: body.price as number,
    categoryId: body.categoryId as string | null,
    imageUrl: (body.imageUrl as string | null)?.trim() || null,
    earnsStamp: body.earnsStamp,
    isActive: body.isActive,
    modifierGroupIds: [...new Set(body.modifierGroupIds as string[])],
  };
}

@Injectable()
export class MenuService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getMenu(shopId: string) {
    const db = this.database.connection;
    const [categories, products, modifierGroups] = await Promise.all([
      db`select id::text as id, shop_id::text as "shopId", name, sort
         from categories where shop_id = ${shopId}::uuid order by sort asc, name asc`,
      db`select p.id::text as id, p.name, p.base_price_satang as "basePriceSatang",
            p.image_url as "imageUrl", p.is_active as "isActive", p.sold_out as "soldOut",
            p.earns_stamp as "earnsStamp", p.category_id::text as "categoryId", c.name as "categoryName"
         from products p left join categories c on c.id = p.category_id and c.shop_id = ${shopId}::uuid
         where p.shop_id = ${shopId}::uuid
         order by coalesce(c.sort, 2147483647), p.sort asc, p.name asc`,
      db`select mg.id::text as id, mg.name, mg.min_select as "minSelect", mg.max_select as "maxSelect",
            coalesce(array_agg(m.name order by m.sort) filter (where m.name is not null), '{}') as "modifierNames"
         from modifier_groups mg left join modifiers m on m.group_id = mg.id
         where mg.shop_id = ${shopId}::uuid
         group by mg.id order by mg.sort asc, mg.name asc`,
    ]);
    return { categories, products, modifierGroups };
  }

  async getProduct(shopId: string, productId: string) {
    const db = this.database.connection;
    const [rows, links] = await Promise.all([
      db`select id::text as id, shop_id::text as "shopId", category_id::text as "categoryId",
            name, base_price_satang as "basePriceSatang", image_url as "imageUrl", is_active as "isActive",
            sold_out as "soldOut", earns_stamp as "earnsStamp", sort, created_at as "createdAt"
         from products where id = ${productId}::uuid and shop_id = ${shopId}::uuid limit 1`,
      db`select pmg.group_id::text as "groupId" from product_modifier_groups pmg
         join products p on p.id = pmg.product_id and p.shop_id = ${shopId}::uuid
         join modifier_groups mg on mg.id = pmg.group_id and mg.shop_id = ${shopId}::uuid
         where pmg.product_id = ${productId}::uuid order by pmg.sort`,
    ]);
    if (!rows[0]) throw new NotFoundException("Product not found");
    return { ...rows[0], modifierGroupIds: links.map((link) => link.groupId) };
  }

  async toggleProductSoldOut(shopId: string, productId: string) {
    const [product] = await this.database.connection<{ soldOut: boolean }[]>`
      update products set sold_out = not sold_out
      where id = ${productId}::uuid and shop_id = ${shopId}::uuid
      returning sold_out as "soldOut"
    `;
    return product ?? null;
  }

  async createCategory(shopId: string, value: unknown) {
    const name = parseName(record(value).name);
    const db = this.database.connection;
    const result = await db.begin(async (tx) => {
      const existing = await tx`select id from categories where shop_id = ${shopId}::uuid and lower(name) = lower(${name}) limit 1`;
      if (existing.length) throw new ConflictException("Category already exists");
      const [sortRow] = await tx`select coalesce(max(sort), -1) + 1 as sort from categories where shop_id = ${shopId}::uuid`;
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
      if (duplicate.length) throw new ConflictException("Category already exists");
      return tx`update categories set name = ${name}
        where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid
        returning id::text as id, shop_id::text as "shopId", name, sort`;
    });
    if (!updated) throw new NotFoundException("Category not found");
    return [updated];
  }

  async deleteCategory(shopId: string, categoryId: string) {
    const [deleted] = await this.database.connection`
      delete from categories where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid returning id::text as id`;
    if (!deleted) throw new NotFoundException("Category not found");
    return [deleted];
  }

  async createProduct(shopId: string, value: unknown) {
    const input = parseProduct(value);
    const db = this.database.connection;
    return db.begin(async (tx) => {
      await this.assertCategory(tx, shopId, input.categoryId);
      await this.assertModifierGroups(tx, shopId, input.modifierGroupIds);
      const [sortRow] = await tx`select coalesce(max(sort), -1) + 1 as sort from products where shop_id = ${shopId}::uuid`;
      const [product] = await tx`insert into products (shop_id, category_id, name, base_price_satang, image_url, earns_stamp, is_active, sort)
        values (${shopId}::uuid, ${input.categoryId}::uuid, ${input.name}, ${input.price}, ${input.imageUrl}, ${input.earnsStamp}, ${input.isActive}, ${sortRow.sort})
        returning id::text as id, shop_id::text as "shopId", category_id::text as "categoryId", name,
          base_price_satang as "basePriceSatang", image_url as "imageUrl", is_active as "isActive",
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
      const [product] = await tx`select id from products where id = ${productId}::uuid and shop_id = ${shopId}::uuid for update`;
      if (!product) throw new NotFoundException("Product not found");
      await this.assertCategory(tx, shopId, input.categoryId);
      await this.assertModifierGroups(tx, shopId, input.modifierGroupIds);
      await tx`update products set category_id = ${input.categoryId}::uuid, name = ${input.name},
        base_price_satang = ${input.price}, image_url = ${input.imageUrl}, earns_stamp = ${input.earnsStamp},
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
    if (!deleted) throw new NotFoundException("Product not found");
    return [deleted];
  }

  async bulkUpdateProducts(shopId: string, value: unknown) {
    const body = record(value);
    if (!Array.isArray(body.productIds) || body.productIds.length < 1 || body.productIds.length > 200 ||
      body.productIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
      throw new BadRequestException("Product ids must contain 1 to 200 valid ids");
    }
    const productIds = [...new Set(body.productIds as string[])];
    if (body.restoreForSale === true) {
      const updated = await this.database.connection`
        update products set is_active = true, sold_out = false
        where shop_id = ${shopId}::uuid and id = any(${productIds}::uuid[]) returning id::text as id`;
      return updated;
    }
    if (typeof body.isActive !== "boolean" || body.restoreForSale !== undefined) {
      throw new BadRequestException("Provide isActive or restoreForSale=true");
    }
    const updated = await this.database.connection`
      update products set is_active = ${body.isActive}
      where shop_id = ${shopId}::uuid and id = any(${productIds}::uuid[]) returning id::text as id`;
    return updated;
  }

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
      const [maxRow] = await tx`select coalesce(max(sort), -1) + 1 as sort from products where shop_id = ${shopId}::uuid`;
      let sort = Number(maxRow.sort);
      let added = 0;
      let linkedProducts = 0;
      for (const [slug, name, category, price, kind] of STOCK_MENU) {
        if (existingNames.has(name)) continue;
        const [product] = await tx`insert into products
          (shop_id, category_id, name, base_price_satang, image_url, earns_stamp, is_active, sort)
          values (${shopId}::uuid, ${categoryIds.get(category)}::uuid, ${name}, ${price}, ${`/assets/menu/${slug}.webp`}, ${kind !== "bakery"}, true, ${sort++})
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

  async clearSoldOut(shopId: string) {
    const updated = await this.database.connection`
      update products set sold_out = false where shop_id = ${shopId}::uuid and sold_out = true returning id::text as id`;
    return updated;
  }

  private async assertCategory(tx: TransactionSql, shopId: string, categoryId: string | null) {
    if (categoryId === null) return;
    const rows = await tx`select id from categories where id = ${categoryId}::uuid and shop_id = ${shopId}::uuid limit 1`;
    if (!rows.length) throw new BadRequestException("Category does not belong to this shop");
  }

  private async assertModifierGroups(tx: TransactionSql, shopId: string, groupIds: string[]) {
    if (!groupIds.length) return;
    const rows = await tx`select id from modifier_groups where shop_id = ${shopId}::uuid and id = any(${groupIds}::uuid[])`;
    if (rows.length !== groupIds.length) throw new BadRequestException("Modifier group does not belong to this shop");
  }
}
