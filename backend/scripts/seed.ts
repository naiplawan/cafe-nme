import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPin } from "../../frontend/src/lib/pin";
import { legacyProductImageSrc } from "../../frontend/src/lib/menu-catalog";
import { hashPassword } from "../src/auth-crypto";
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
  users,
} from "../src/db/schema";

config({ path: [".env.production.local", "../frontend/.env.local"] });

const productionSeed = process.env.SEED_TARGET === "production";
const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@demo.test";
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "password123";
const ownerPin = process.env.SEED_OWNER_PIN ?? "1234";
const baristaPin = process.env.SEED_BARISTA_PIN ?? "1111";

async function seed() {
  if (productionSeed) {
    if (process.env.SEED_CONFIRM_PRODUCTION !== "demo-cafe") {
      throw new Error("Production seed requires SEED_CONFIRM_PRODUCTION=demo-cafe.");
    }
    if (!process.env.SEED_OWNER_EMAIL || !process.env.SEED_OWNER_PASSWORD || ownerPassword === "password123") {
      throw new Error("Production seed requires a custom SEED_OWNER_EMAIL and non-default SEED_OWNER_PASSWORD.");
    }
    if (!/^\d{6}$/.test(ownerPin) || !/^\d{6}$/.test(baristaPin) || ownerPin === baristaPin) {
      throw new Error("Production seed requires different six-digit SEED_OWNER_PIN and SEED_BARISTA_PIN values.");
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL in backend/.env.production.local or frontend/.env.local.");
  }
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail.toLowerCase())).limit(1);
    const authUserId = existingUser?.id;
    const [existingStaff] = authUserId
      ? await db.select({ id: staff.id, shopId: staff.shopId }).from(staff).where(eq(staff.authUserId, authUserId)).limit(1)
      : [];

    if (existingStaff) {
      if (productionSeed) {
        await db.update(staff).set({ pinHash: await hashPin(ownerPin) }).where(eq(staff.id, existingStaff.id));
        await db.update(staff)
          .set({ pinHash: await hashPin(baristaPin) })
          .where(and(eq(staff.shopId, existingStaff.shopId), eq(staff.role, "barista")));
      }
      console.info(productionSeed
        ? "Demo staff account exists; production PINs refreshed."
        : "Demo owner already has a staff account; seed skipped.");
      return;
    }
    if (productionSeed && existingUser) {
      throw new Error("The production owner email already exists without a seeded staff account; use a new email to avoid changing its credentials.");
    }
    const [existingShop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, "demo-cafe")).limit(1);
    if (existingShop) {
      throw new Error("A shop with slug demo-cafe already exists; seed skipped to protect existing production data.");
    }

    await db.transaction(async (tx) => {
      const userId = authUserId ?? (await tx.insert(users).values({
        email: ownerEmail.toLowerCase(),
        passwordHash: await hashPassword(ownerPassword),
      }).returning({ id: users.id }))[0].id;
      const [shop] = await tx
        .insert(shops)
        .values({ name: "Cafe'nMe", slug: "demo-cafe", promptpayId: null })
        .returning({ id: shops.id });

      const [owner] = await tx
        .insert(staff)
        .values([
          { shopId: shop.id, name: "เจ้าของร้าน", role: "owner" as const, authUserId: userId, pinHash: await hashPin(ownerPin) },
          { shopId: shop.id, name: "มินท์", role: "barista" as const, pinHash: await hashPin(baristaPin) },
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
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "อเมริกาโน่", basePriceSatang: 5000, imageUrl: legacyProductImageSrc("product-americano.png"), sort: 0 },
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "ลาเต้", basePriceSatang: 5500, imageUrl: legacyProductImageSrc("product-latte.png"), sort: 1 },
          { shopId: shop.id, categoryId: categoryId.get("กาแฟ"), name: "คาปูชิโน่", basePriceSatang: 5500, sort: 2 },
          { shopId: shop.id, categoryId: categoryId.get("ชา"), name: "ชาไทย", basePriceSatang: 4500, imageUrl: legacyProductImageSrc("product-thai-tea.png"), sort: 3 },
          { shopId: shop.id, categoryId: categoryId.get("ชา"), name: "มัทฉะลาเต้", basePriceSatang: 6000, imageUrl: legacyProductImageSrc("product-matcha-latte.png"), sort: 4 },
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

    console.info(`Demo café seeded for ${ownerEmail}; owner and barista PINs set, member phone 0814821000.`);
  } finally {
    await client.end();
  }
}

seed().catch((error: unknown) => {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
});
