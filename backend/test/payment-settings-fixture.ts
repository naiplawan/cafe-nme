import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";

export interface PaymentSettingsDatabase {
  connection: Sql;
}

export interface PaymentSettingsFixture {
  database: PaymentSettingsDatabase;
  shopId: string;
  ownerId: string;
  managerId: string;
  baristaId: string;
  inactiveOwnerId: string;
  otherShopOwnerId: string;
  dispose: () => Promise<void>;
}

export async function createPaymentSettingsFixture(databaseUrl: string): Promise<PaymentSettingsFixture> {
  const sql = postgres(databaseUrl, { prepare: false, max: 5 });
  const suffix = randomUUID();

  try {
    const [shop] = await sql<{ id: string }[]>`
      insert into shops (name, slug)
      values ('Payment settings test shop', ${`payment-settings-test-${suffix}`})
      returning id::text as id
    `;
    const [otherShop] = await sql<{ id: string }[]>`
      insert into shops (name, slug)
      values ('Payment settings other shop', ${`payment-settings-other-${suffix}`})
      returning id::text as id
    `;

    const [owner] = await sql<{ id: string }[]>`
      insert into staff (shop_id, name, role)
      values (${shop.id}::uuid, 'Payment settings owner', 'owner')
      returning id::text as id
    `;
    const [manager] = await sql<{ id: string }[]>`
      insert into staff (shop_id, name, role)
      values (${shop.id}::uuid, 'Payment settings manager', 'manager')
      returning id::text as id
    `;
    const [barista] = await sql<{ id: string }[]>`
      insert into staff (shop_id, name, role)
      values (${shop.id}::uuid, 'Payment settings barista', 'barista')
      returning id::text as id
    `;
    const [inactiveOwner] = await sql<{ id: string }[]>`
      insert into staff (shop_id, name, role, is_active)
      values (${shop.id}::uuid, 'Payment settings inactive owner', 'owner', false)
      returning id::text as id
    `;
    const [otherShopOwner] = await sql<{ id: string }[]>`
      insert into staff (shop_id, name, role)
      values (${otherShop.id}::uuid, 'Payment settings other owner', 'owner')
      returning id::text as id
    `;

    return {
      database: { connection: sql },
      shopId: shop.id,
      ownerId: owner.id,
      managerId: manager.id,
      baristaId: barista.id,
      inactiveOwnerId: inactiveOwner.id,
      otherShopOwnerId: otherShopOwner.id,
      async dispose() {
        await sql`
          delete from shops
          where id in (${shop.id}::uuid, ${otherShop.id}::uuid)
        `;
        await sql.end();
      },
    };
  } catch (error) {
    await sql.end();
    throw error;
  }
}
