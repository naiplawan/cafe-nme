import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
import { clearExpiredSoldOut } from "./sold-out.js";

export interface MenuCategory { id: string; name: string }
export interface MenuModifier { id: string; name: string; priceDeltaSatang: number }
export interface MenuProduct {
  id: string;
  name: string;
  categoryId: string | null;
  basePriceSatang: number;
  imageUrl: string | null;
  tileColor: string | null;
  earnsStamp: boolean;
  soldOut: boolean;
  groups: { id: string; name: string; minSelect: number; maxSelect: number; modifiers: MenuModifier[] }[];
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getPosMenu(shopId: string): Promise<{ categories: MenuCategory[]; products: MenuProduct[] }> {
    const db = this.database.connection;
    await clearExpiredSoldOut(db, shopId);
    const [categories, products] = await Promise.all([
      db<MenuCategory[]>`
        select id::text as id, name
        from categories
        where shop_id = ${shopId}::uuid
        order by sort asc, name asc
      `,
      db<(Omit<MenuProduct, "groups"> & { sort: number })[]>`
        select id::text as id, name, category_id::text as "categoryId",
          base_price_satang as "basePriceSatang", image_url as "imageUrl", tile_color as "tileColor",
          earns_stamp as "earnsStamp", sold_out as "soldOut", sort
        from products
        where shop_id = ${shopId}::uuid and is_active = true
        order by sort asc, name asc
      `,
    ]);

    if (products.length === 0) {
      return { categories, products: [] };
    }

    const rows = await db<{
      productId: string;
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      modifierId: string | null;
      modifierName: string | null;
      priceDeltaSatang: number | null;
      groupSort: number;
      modifierSort: number | null;
    }[]>`
      select pmg.product_id::text as "productId", mg.id::text as id, mg.name,
        mg.min_select as "minSelect", mg.max_select as "maxSelect",
        m.id::text as "modifierId", m.name as "modifierName",
        m.price_delta_satang as "priceDeltaSatang", pmg.sort as "groupSort",
        m.sort as "modifierSort"
      from product_modifier_groups pmg
      join products p on p.id = pmg.product_id
      join modifier_groups mg on mg.id = pmg.group_id and mg.shop_id = ${shopId}::uuid
      left join modifiers m on m.group_id = mg.id
      where p.shop_id = ${shopId}::uuid and p.is_active = true
      order by pmg.sort asc, mg.sort asc, m.sort asc
    `;

    const groupsByProduct = new Map<string, Map<string, {
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      sort: number;
      modifiers: (MenuModifier & { sort: number })[];
    }>>();

    for (const row of rows) {
      const groups = groupsByProduct.get(row.productId) ?? new Map();
      const group = groups.get(row.id) ?? {
        id: row.id,
        name: row.name,
        minSelect: row.minSelect,
        maxSelect: row.maxSelect,
        sort: row.groupSort,
        modifiers: [],
      };
      if (row.modifierId && row.modifierName !== null && row.priceDeltaSatang !== null) {
        group.modifiers.push({
          id: row.modifierId,
          name: row.modifierName,
          priceDeltaSatang: row.priceDeltaSatang,
          sort: row.modifierSort ?? 0,
        });
      }
      groups.set(row.id, group);
      groupsByProduct.set(row.productId, groups);
    }

    return {
      categories,
      products: products.map(({ sort: _sort, ...product }) => ({
        ...product,
        groups: [...(groupsByProduct.get(product.id)?.values() ?? [])]
          .sort((a, b) => a.sort - b.sort)
          .filter((group) => group.modifiers.length > 0 || group.minSelect > 0)
          .map(({ sort: _groupSort, modifiers, ...group }) => ({
            ...group,
            modifiers: modifiers
              .sort((a, b) => a.sort - b.sort)
              .map(({ sort: _modifierSort, ...modifier }) => modifier),
          })),
      })),
    };
  }
}
