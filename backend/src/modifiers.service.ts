import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STANDARD_GROUPS = [
  { name: "ความหวาน", minSelect: 1, maxSelect: 1, modifiers: [{ name: "0%", priceDeltaSatang: 0 }, { name: "25%", priceDeltaSatang: 0 }, { name: "50%", priceDeltaSatang: 0 }, { name: "100%", priceDeltaSatang: 0 }] },
  { name: "ประเภท", minSelect: 1, maxSelect: 1, modifiers: [{ name: "ร้อน", priceDeltaSatang: 0 }, { name: "เย็น", priceDeltaSatang: 500 }, { name: "ปั่น", priceDeltaSatang: 1000 }] },
  { name: "นม", minSelect: 0, maxSelect: 1, modifiers: [{ name: "นมโอ๊ต", priceDeltaSatang: 1500 }, { name: "นมอัลมอนด์", priceDeltaSatang: 1500 }] },
  { name: "ช็อตเพิ่ม", minSelect: 0, maxSelect: 2, modifiers: [{ name: "เพิ่มช็อต", priceDeltaSatang: 1500 }] },
] as const;
const PRODUCT_GROUPS = {
  coffee: ["ความหวาน", "ประเภท", "นม", "ช็อตเพิ่ม"],
  milk: ["ความหวาน", "ประเภท", "นม"],
  drink: ["ความหวาน", "ประเภท"],
  bakery: [],
  other: ["ความหวาน", "ประเภท"],
} as const;
const CATALOG_KIND = new Map<string, keyof typeof PRODUCT_GROUPS>([
  ["เอสเพรสโซ่", "coffee"], ["อเมริกาโน่เย็น", "coffee"], ["คาปูชิโน่", "coffee"],
  ["มอคค่า", "coffee"], ["คาราเมลมัคคิอาโต้", "coffee"], ["แฟลตไวท์", "coffee"],
  ["เดอร์ตี้", "coffee"], ["อเมริกาโน่มะพร้าว", "coffee"], ["เอสเพรสโซ่ส้ม", "coffee"],
  ["โอเลี้ยง", "drink"], ["ชาเขียวนม", "milk"], ["ชามะนาว", "drink"], ["มัทฉะเพียว", "drink"],
  ["มัทฉะมะพร้าว", "drink"], ["โฮจิฉะลาเต้", "milk"], ["มัทฉะสตรอว์เบอร์รี", "milk"],
  ["ชาพีช", "drink"], ["ชาน้ำผึ้งมะนาว", "drink"], ["โกโก้", "milk"], ["นมชมพู", "milk"],
  ["นมคาราเมล", "milk"], ["แดงมะนาวโซดา", "drink"], ["มะม่วงปั่น", "drink"],
  ["อัญชันมะนาว", "drink"], ["ครัวซองต์เนย", "bakery"], ["เค้กกล้วยหอม", "bakery"],
  ["บราวนี่", "bakery"], ["เครปเค้กชาไทย", "bakery"], ["ปังปิ้งเนยนม", "bakery"],
  ["ซินนามอนโรล", "bakery"],
]);

function object(value: unknown): Record<string, unknown> {
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

function parseGroup(value: unknown) {
  const body = object(value);
  const name = parseName(body.name);
  const { minSelect, maxSelect } = body;
  if (!Number.isInteger(minSelect) || (minSelect as number) < 0 || (minSelect as number) > 20 ||
      !Number.isInteger(maxSelect) || (maxSelect as number) < 1 || (maxSelect as number) > 20 ||
      (minSelect as number) > (maxSelect as number)) {
    throw new BadRequestException("Selection limits are invalid");
  }
  return { name, minSelect: minSelect as number, maxSelect: maxSelect as number };
}

function parseOption(value: unknown) {
  const body = object(value);
  const name = parseName(body.name);
  if (!Number.isSafeInteger(body.priceDeltaSatang)) throw new BadRequestException("Price delta must be an integer in satang");
  return { name, priceDeltaSatang: body.priceDeltaSatang as number };
}

@Injectable()
export class ModifiersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(shopId: string) {
    const db = this.database.connection;
    const groups = await db`select id::text as id, name, min_select as "minSelect", max_select as "maxSelect", sort
      from modifier_groups where shop_id = ${shopId}::uuid order by sort asc, name asc`;
    if (!groups.length) return [];
    const groupIds = groups.map((group) => group.id);
    const [options, assignments] = await Promise.all([
      db`select id::text as id, group_id::text as "groupId", name,
          price_delta_satang as "priceDeltaSatang", sort from modifiers
        where group_id = any(${groupIds}::uuid[]) order by sort asc, name asc`,
      db`select pmg.group_id::text as "groupId", p.id::text as "productId", p.name as "productName"
        from product_modifier_groups pmg
        join products p on p.id = pmg.product_id and p.shop_id = ${shopId}::uuid
        join modifier_groups mg on mg.id = pmg.group_id and mg.shop_id = ${shopId}::uuid
        where pmg.group_id = any(${groupIds}::uuid[]) order by p.name asc`,
    ]);
    return groups.map((group) => {
      const groupOptions = options.filter((option) => option.groupId === group.id);
      const linkedProducts = assignments.filter((assignment) => assignment.groupId === group.id);
      return {
        ...group,
        modifiers: groupOptions,
        productIds: linkedProducts.map((assignment) => assignment.productId),
        productNames: linkedProducts.map((assignment) => assignment.productName),
      };
    });
  }

  async createGroup(shopId: string, value: unknown) {
    const input = parseGroup(value);
    const [row] = await this.database.connection`insert into modifier_groups (shop_id, name, min_select, max_select)
      values (${shopId}::uuid, ${input.name}, ${input.minSelect}, ${input.maxSelect}) returning id::text as id`;
    return row;
  }

  async createStandardGroups(shopId: string) {
    const db = this.database.connection;
    return db.begin(async (tx) => {
      const existing = await tx`select name from modifier_groups where shop_id = ${shopId}::uuid`;
      const existingNames = new Set(existing.map((group) => group.name));
      const created = new Map<string, string>();
      for (const preset of STANDARD_GROUPS) {
        if (existingNames.has(preset.name)) continue;
        const [group] = await tx`insert into modifier_groups (shop_id, name, min_select, max_select)
          values (${shopId}::uuid, ${preset.name}, ${preset.minSelect}, ${preset.maxSelect}) returning id::text as id`;
        await tx`insert into modifiers (group_id, name, price_delta_satang, sort)
          select ${group.id}::uuid, item.name, item.price, item.ordinality - 1
          from unnest(${preset.modifiers.map((item) => item.name)}::text[], ${preset.modifiers.map((item) => item.priceDeltaSatang)}::int[])
            with ordinality as item(name, price, ordinality)`;
        created.set(preset.name, group.id);
      }
      if (created.size === 0) return { created: 0, linkedProducts: 0 };

      const products = await tx`select p.id::text as id, p.name, c.name as "categoryName"
        from products p left join categories c on c.id = p.category_id and c.shop_id = ${shopId}::uuid
        where p.shop_id = ${shopId}::uuid`;
      const productsWithGroups = products.filter((product) => {
        const kind = CATALOG_KIND.get(product.name) ?? (product.categoryName === "เบเกอรี่" ? "bakery" : "other");
        return PRODUCT_GROUPS[kind].some((name) => created.has(name));
      });
      const existingSorts = productsWithGroups.length
        ? await tx`select product_id::text as "productId", coalesce(max(sort), -1) + 1 as sort
            from product_modifier_groups where product_id = any(${productsWithGroups.map((product) => product.id)}::uuid[])
            group by product_id`
        : [];
      const sortByProduct = new Map(existingSorts.map((row) => [row.productId, Number(row.sort)]));
      const assignments = products.flatMap((product) => {
        const kind = CATALOG_KIND.get(product.name) ?? (product.categoryName === "เบเกอรี่" ? "bakery" : "other");
        return PRODUCT_GROUPS[kind].flatMap((name, sort) => {
          const groupId = created.get(name);
          return groupId ? [{ productId: product.id, groupId, sort: (sortByProduct.get(product.id) ?? 0) + sort }] : [];
        });
      });
      if (assignments.length) {
        await tx`insert into product_modifier_groups (product_id, group_id, sort)
          select item.product_id::uuid, item.group_id::uuid, item.sort
          from unnest(${assignments.map((item) => item.productId)}::text[], ${assignments.map((item) => item.groupId)}::text[], ${assignments.map((item) => item.sort)}::int[])
            as item(product_id, group_id, sort)`;
      }
      return { created: created.size, linkedProducts: new Set(assignments.map((item) => item.productId)).size };
    });
  }

  async updateGroup(shopId: string, groupId: string, value: unknown) {
    const input = parseGroup(value);
    const [updated] = await this.database.connection`update modifier_groups set name = ${input.name}, min_select = ${input.minSelect}, max_select = ${input.maxSelect}
      where id = ${groupId}::uuid and shop_id = ${shopId}::uuid returning id::text as id`;
    if (!updated) throw new NotFoundException("Modifier group not found");
    return [updated];
  }

  async deleteGroup(shopId: string, groupId: string) {
    const [deleted] = await this.database.connection`delete from modifier_groups where id = ${groupId}::uuid and shop_id = ${shopId}::uuid returning id::text as id`;
    if (!deleted) throw new NotFoundException("Modifier group not found");
    return [deleted];
  }

  async setGroupProducts(shopId: string, groupId: string, value: unknown) {
    const body = object(value);
    if (!Array.isArray(body.productIds) || body.productIds.length > 500 || body.productIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
      throw new BadRequestException("Product ids are invalid");
    }
    const uniqueIds = [...new Set(body.productIds as string[])];
    await this.database.connection.begin(async (tx) => {
      const [group] = await tx`select id from modifier_groups where id = ${groupId}::uuid and shop_id = ${shopId}::uuid limit 1`;
      if (!group) throw new NotFoundException("Modifier group not found");
      if (uniqueIds.length) {
        const owned = await tx`select id from products where shop_id = ${shopId}::uuid and id = any(${uniqueIds}::uuid[])`;
        if (owned.length !== uniqueIds.length) throw new NotFoundException("Product not found");
      }
      await tx`delete from product_modifier_groups where group_id = ${groupId}::uuid`;
      if (!uniqueIds.length) return;
      const sorts = await tx`select product_id::text as "productId", coalesce(max(sort), -1) + 1 as sort
        from product_modifier_groups where product_id = any(${uniqueIds}::uuid[]) group by product_id`;
      const sortByProduct = new Map(sorts.map((row) => [row.productId, Number(row.sort)]));
      await tx`insert into product_modifier_groups (product_id, group_id, sort)
        select item.product_id::uuid, ${groupId}::uuid, item.sort
        from unnest(${uniqueIds}::text[], ${uniqueIds.map((id) => sortByProduct.get(id) ?? 0)}::int[])
          as item(product_id, sort)`;
    });
    return { success: true };
  }

  async createOption(shopId: string, groupId: string, value: unknown) {
    const input = parseOption(value);
    const db = this.database.connection;
    return db.begin(async (tx) => {
      const [group] = await tx`select id from modifier_groups where id = ${groupId}::uuid and shop_id = ${shopId}::uuid limit 1`;
      if (!group) throw new NotFoundException("Modifier group not found");
      const [sortRow] = await tx`select coalesce(max(sort), -1) + 1 as sort from modifiers where group_id = ${groupId}::uuid`;
      const [created] = await tx`insert into modifiers (group_id, name, price_delta_satang, sort)
        values (${groupId}::uuid, ${input.name}, ${input.priceDeltaSatang}, ${sortRow.sort}) returning id::text as id`;
      return created;
    });
  }

  async updateOption(shopId: string, modifierId: string, value: unknown) {
    const input = parseOption(value);
    const [updated] = await this.database.connection`update modifiers m set name = ${input.name}, price_delta_satang = ${input.priceDeltaSatang}
      from modifier_groups mg where m.id = ${modifierId}::uuid and mg.id = m.group_id and mg.shop_id = ${shopId}::uuid
      returning m.id::text as id`;
    if (!updated) throw new NotFoundException("Modifier not found");
    return [updated];
  }

  async deleteOption(shopId: string, modifierId: string) {
    const [deleted] = await this.database.connection`delete from modifiers m using modifier_groups mg
      where m.id = ${modifierId}::uuid and mg.id = m.group_id and mg.shop_id = ${shopId}::uuid
      returning m.id::text as id`;
    if (!deleted) throw new NotFoundException("Modifier not found");
    return [deleted];
  }
}
