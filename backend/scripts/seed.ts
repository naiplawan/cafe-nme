import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { hashPin } from "../../frontend/src/lib/pin";
import {
  categories,
  members,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
  shops,
  staff,
  stampLedger,
} from "../src/db/schema";

config({ path: "../frontend/.env.local" });

const ownerEmail = "owner@demo.test";
const ownerPassword = "password123";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    throw new Error("Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  async function findAuthUserId() {
    const perPage = 100;
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const user = data.users.find((candidate) => candidate.email === ownerEmail);
      if (user) return user.id;
      if (data.users.length < perPage) return null;
    }
  }

  let authUserId = await findAuthUserId();
  if (!authUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    if (error) authUserId = await findAuthUserId(); else authUserId = data.user.id;
    if (!authUserId) throw error;
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const [existingStaff] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.authUserId, authUserId))
      .limit(1);

    if (existingStaff) {
      console.info("Demo owner already has a staff account; seed skipped.");
      return;
    }

    await db.transaction(async (tx) => {
      const [shop] = await tx
        .insert(shops)
        .values({ name: "Cafe'nMe", slug: "demo-cafe", promptpayId: "0812345678" })
        .returning({ id: shops.id });

      // Demo POS PINs: owner 1234, barista 1111.
      const [owner] = await tx
        .insert(staff)
        .values([
          { shopId: shop.id, name: "เจ้าของร้าน", role: "owner" as const, authUserId, pinHash: await hashPin("1234") },
          { shopId: shop.id, name: "มินท์", role: "barista" as const, pinHash: await hashPin("1111") },
        ])
        .returning({ id: staff.id });

      // Demo member linked to the LIFF dev mock user (LINE_DEV_MOCK=1), 8 of 10 stamps.
      const [member] = await tx
        .insert(members)
        .values({
          shopId: shop.id,
          displayName: "คุณแพรว",
          phone: "0814821000",
          lineUserId: "U-dev-demo-cafe",
          consentAt: new Date(),
        })
        .returning({ id: members.id });
      await tx.insert(stampLedger).values({
        shopId: shop.id,
        memberId: member.id,
        delta: 8,
        reason: "adjust",
        staffId: owner.id,
      });

      const categoryRows = await tx
        .insert(categories)
        .values([
          { shopId: shop.id, name: "กาแฟ", sort: 0 },
          { shopId: shop.id, name: "ชา", sort: 1 },
          { shopId: shop.id, name: "อื่นๆ", sort: 2 },
        ])
        .returning({ id: categories.id, name: categories.name });
      const categoryId = new Map(categoryRows.map((category) => [category.name, category.id]));

      const groupRows = await tx
        .insert(modifierGroups)
        .values([
          { shopId: shop.id, name: "ความหวาน", minSelect: 1, maxSelect: 1, sort: 0 },
          { shopId: shop.id, name: "ประเภท", minSelect: 1, maxSelect: 1, sort: 1 },
          { shopId: shop.id, name: "นม", minSelect: 0, maxSelect: 1, sort: 2 },
          { shopId: shop.id, name: "ช็อตเพิ่ม", minSelect: 0, maxSelect: 2, sort: 3 },
        ])
        .returning({ id: modifierGroups.id, name: modifierGroups.name });
      const groupId = new Map(groupRows.map((group) => [group.name, group.id]));

      await tx.insert(modifiers).values([
        ...["0%", "25%", "50%", "100%"].map((name, sort) => ({
          groupId: groupId.get("ความหวาน")!,
          name,
          priceDeltaSatang: 0,
          sort,
        })),
        { groupId: groupId.get("ประเภท")!, name: "ร้อน", priceDeltaSatang: 0, sort: 0 },
        { groupId: groupId.get("ประเภท")!, name: "เย็น", priceDeltaSatang: 500, sort: 1 },
        { groupId: groupId.get("ประเภท")!, name: "ปั่น", priceDeltaSatang: 1000, sort: 2 },
        { groupId: groupId.get("นม")!, name: "นมโอ๊ต", priceDeltaSatang: 1500, sort: 0 },
        { groupId: groupId.get("นม")!, name: "นมอัลมอนด์", priceDeltaSatang: 1500, sort: 1 },
        { groupId: groupId.get("ช็อตเพิ่ม")!, name: "เพิ่มช็อต", priceDeltaSatang: 1500, sort: 0 },
      ]);

      const productRows = await tx
        .insert(products)
        .values([
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "อเมริกาโน่", basePriceSatang: 5000, imageUrl: "/assets/product-americano.png", sort: 0 },
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "ลาเต้", basePriceSatang: 5500, imageUrl: "/assets/product-latte.png", sort: 1 },
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "คาปูชิโน่", basePriceSatang: 5500, sort: 2 },
          { shopId: shop.id, categoryId: categoryId.get("ชา"), name: "ชาไทย", basePriceSatang: 4500, imageUrl: "/assets/product-thai-tea.png", sort: 3 },
          { shopId: shop.id, categoryId: categoryId.get("ชา"), name: "มัทฉะลาเต้", basePriceSatang: 6000, imageUrl: "/assets/product-matcha-latte.png", sort: 4 },
          { shopId: shop.id, categoryId: categoryId.get("อื่นๆ"), name: "โกโก้", basePriceSatang: 4500, sort: 5 },
        ])
        .returning({ id: products.id, name: products.name });

      const coffeeProducts = ["อเมริกาโน่", "ลาเต้", "คาปูชิโน่"];
      const milkProducts = [...coffeeProducts, "มัทฉะลาเต้", "โกโก้"];
      const links = productRows.flatMap((product) => {
        const groups = [groupId.get("ความหวาน")!, groupId.get("ประเภท")!];
        if (milkProducts.includes(product.name)) groups.push(groupId.get("นม")!);
        if (coffeeProducts.includes(product.name)) groups.push(groupId.get("ช็อตเพิ่ม")!);
        return groups.map((modifierGroupId, sort) => ({
          productId: product.id,
          groupId: modifierGroupId,
          sort,
        }));
      });
      await tx.insert(productModifierGroups).values(links);
    });

    console.info("Demo café seeded: owner@demo.test / password123, POS PINs owner 1234 and barista 1111, member phone 0814821000.");
  } finally {
    await client.end();
  }
}

seed().catch((error: unknown) => {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
});
