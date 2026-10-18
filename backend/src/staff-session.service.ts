import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

@Injectable()
export class StaffSessionService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listByAuthUserId(authUserId: string) {
    const rows = await this.database.connection<{
      staff_id: string;
      staff_name: string;
      staff_role: "owner" | "manager" | "barista";
      shop_id: string;
      shop_name: string;
    }[]>`
      SELECT
        s.id::text AS staff_id,
        s.name AS staff_name,
        s.role AS staff_role,
        sh.id::text AS shop_id,
        sh.name AS shop_name
      FROM staff s
      INNER JOIN shops sh ON sh.id = s.shop_id
      WHERE s.auth_user_id = ${authUserId}::uuid
        AND s.is_active = true
      ORDER BY sh.created_at, sh.name, sh.id
    `;

    return rows.map((row) => this.toSession(row));
  }

  async getByAuthUserIdAndShopId(authUserId: string, shopId: string) {
    const [row] = await this.database.connection<{
      staff_id: string;
      staff_name: string;
      staff_role: "owner" | "manager" | "barista";
      shop_id: string;
      shop_name: string;
    }[]>`
      SELECT
        s.id::text AS staff_id,
        s.name AS staff_name,
        s.role AS staff_role,
        sh.id::text AS shop_id,
        sh.name AS shop_name
      FROM staff s
      INNER JOIN shops sh ON sh.id = s.shop_id
      WHERE s.auth_user_id = ${authUserId}::uuid
        AND s.shop_id = ${shopId}::uuid
        AND s.is_active = true
      LIMIT 1
    `;

    return row ? this.toSession(row) : null;
  }

  async getByAuthUserId(authUserId: string) {
    const [membership] = await this.listByAuthUserId(authUserId);
    return membership ?? null;
  }

  private toSession(row: {
    staff_id: string;
    staff_name: string;
    staff_role: "owner" | "manager" | "barista";
    shop_id: string;
    shop_name: string;
  }) {
    return {
      staff: { id: row.staff_id, name: row.staff_name, role: row.staff_role },
      shop: { id: row.shop_id, name: row.shop_name },
      shopId: row.shop_id,
    };
  }
}
