import { createHash, randomBytes, randomInt, randomUUID, scryptSync } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eDatabaseUrl } from "./environment";

interface ShopFixture {
  sql: ReturnType<typeof postgres>;
  shopId: string;
  pairingCode: string;
}

const LOGIN_URL = /\/pos\/login$/;
const POS_URL = /\/pos$/;
const OWNER_NAME = /E2E Owner/;
const PRODUCT_NAME = /ลาเต้ทดสอบ/;
const MODIFIER_NAME = /นมโอ๊ต/;

export const test = base.extend<{ shop: ShopFixture }>({
  shop: async ({ page }, use) => {
    const sql = postgres(e2eDatabaseUrl(), { max: 1 });
    const shopId = randomUUID();
    const deviceId = randomUUID();
    const clientAddress = `127.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
    const rateLimitKeys = [`pos-pair:${clientAddress}`, `pos-login:${deviceId}`]
      .map((key) => createHash("sha256").update(key).digest("hex"));
    const productId = randomUUID();
    const groupId = randomUUID();
    const salt = randomBytes(16);
    const pinHash = `scrypt$${salt.toString("base64")}$${scryptSync("246810", salt, 64).toString("base64")}`;
    const pairingCode = randomInt(0, 100_000_000).toString().padStart(8, "0");
    try {
      await sql.begin(async (tx) => {
        await tx`insert into shops(id,name,slug) values(${shopId},'E2E Café',${`e2e-${shopId}`})`;
        await tx`insert into staff(shop_id,name,role,pin_hash) values(${shopId},'E2E Owner','owner',${pinHash})`;
        await tx`insert into pos_devices(id,shop_id,name,pairing_code_hash,pairing_expires_at)
          values(${deviceId},${shopId},'E2E Tablet',${createHash("sha256").update(pairingCode).digest("hex")},now()+interval '10 minutes')`;
        await tx`insert into products(id,shop_id,name,base_price_satang) values(${productId},${shopId},'ลาเต้ทดสอบ',6000)`;
        await tx`insert into modifier_groups(id,shop_id,name,min_select,max_select) values(${groupId},${shopId},'นม',1,1)`;
        await tx`insert into modifiers(group_id,name,price_delta_satang) values(${groupId},'นมโอ๊ต',1000)`;
        await tx`insert into product_modifier_groups(product_id,group_id) values(${productId},${groupId})`;
      });
      // Simulate trusted ingress without sharing pairing limits across test runs.
      await page.setExtraHTTPHeaders({ "x-real-ip": clientAddress });
      await use({ sql, shopId, pairingCode });
    } finally {
      try {
        await sql`delete from shops where id=${shopId}`;
        await sql`delete from rate_limit_attempts where key in ${sql(rateLimitKeys)}`;
      }
      finally { await sql.end(); }
    }
  },
});

export { expect } from "@playwright/test";

export async function pairAndLogin(page: Page, pairingCode: string) {
  await page.goto("/pos/pair");
  for (const digit of pairingCode) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "จับคู่แท็บเล็ต", exact: true }).click();
  await expect(page).toHaveURL(LOGIN_URL);
  await page.getByRole("button", { name: OWNER_NAME }).click();
  for (const digit of "246810") {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(POS_URL);
}

export async function openShift(page: Page) {
  await page.goto("/pos/shifts");
  await page.getByLabel("เงินทอนเริ่มต้น (บาท)").fill("500");
  await page.getByRole("button", { name: "เปิดกะเงินสด", exact: true }).click();
  await expect(page.getByText("เงินสดที่ควรมี ฿500", { exact: true })).toBeVisible();
}

export async function prepareCashSale(page: Page) {
  await page.goto("/pos");
  await page.getByRole("button", { name: PRODUCT_NAME }).click();
  const modifiers = page.getByRole("dialog");
  await modifiers.getByRole("button", { name: MODIFIER_NAME }).click();
  await modifiers.getByRole("button", { name: "เพิ่มจำนวน", exact: true }).click();
  await modifiers.getByRole("button", { name: "เพิ่มลงออเดอร์ · ฿140", exact: true }).click();
  await page.getByRole("button", { name: "ชำระเงิน ฿140", exact: true }).click();
  await page.getByLabel("จำนวนเงินที่รับ (บาท)").fill("200");
  await expect(page.getByRole("button", { name: "รับเงิน · ทอน ฿60", exact: true })).toBeEnabled();
}
