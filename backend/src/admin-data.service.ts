import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

@Injectable()
export class AdminDataService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async dashboard(shopId: string) {
    const [row] = await this.database.connection<{
      active_products: number | string;
      all_products: number | string;
      categories: number | string;
      modifier_groups: number | string;
      configured_modifier_groups: number | string;
      owner_pin: boolean;
      pos_device: boolean;
      line_configured: boolean;
      brand_configured: boolean;
    }[]>`
      SELECT
        (SELECT count(*) FROM products p WHERE p.shop_id = ${shopId}::uuid AND p.is_active = true) AS active_products,
        (SELECT count(*) FROM products p WHERE p.shop_id = ${shopId}::uuid) AS all_products,
        (SELECT count(*) FROM categories c WHERE c.shop_id = ${shopId}::uuid) AS categories,
        (SELECT count(*) FROM modifier_groups g WHERE g.shop_id = ${shopId}::uuid) AS modifier_groups,
        (SELECT count(*) FROM modifier_groups g JOIN modifiers m ON m.group_id = g.id WHERE g.shop_id = ${shopId}::uuid) AS configured_modifier_groups,
        EXISTS (SELECT 1 FROM staff s WHERE s.shop_id = ${shopId}::uuid AND s.role = 'owner' AND s.pin_hash IS NOT NULL) AS owner_pin,
        EXISTS (SELECT 1 FROM pos_devices d WHERE d.shop_id = ${shopId}::uuid AND d.device_token_hash IS NOT NULL) AS pos_device,
        EXISTS (SELECT 1 FROM line_channels l WHERE l.shop_id = ${shopId}::uuid
          AND l.access_token_enc IS NOT NULL AND l.access_token_enc <> ''
          AND l.liff_id IS NOT NULL AND l.liff_id <> '') AS line_configured,
        EXISTS (SELECT 1 FROM shop_brands b WHERE b.shop_id = ${shopId}::uuid
          AND (b.logo IS NOT NULL OR (b.accent IS NOT NULL AND b.accent <> ''))) AS brand_configured
    `;

    return {
      activeProducts: Number(row.active_products),
      allProducts: Number(row.all_products),
      categoryCount: Number(row.categories),
      groupCount: Number(row.modifier_groups),
      modifierSetup: Number(row.configured_modifier_groups),
      ownerPinSetup: row.owner_pin,
      deviceSetup: row.pos_device,
      lineSetup: row.line_configured,
      brandSetup: row.brand_configured,
    };
  }

  async modifierProducts(shopId: string) {
    return this.database.connection<{
      id: string;
      name: string;
      category_id: string | null;
      category_name: string | null;
    }[]>`
      SELECT p.id, p.name, c.id AS category_id, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.shop_id = p.shop_id
      WHERE p.shop_id = ${shopId}::uuid
      ORDER BY c.sort ASC NULLS LAST, p.sort ASC, p.name ASC
    `.then((rows) => rows.map((row) => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      categoryName: row.category_name,
    })));
  }

  async shopProfile(shopId: string) {
    const [row] = await this.database.connection<{ name: string; slug: string }[]>`
      SELECT name, slug FROM shops WHERE id = ${shopId}::uuid LIMIT 1
    `;
    return row ?? null;
  }
}
