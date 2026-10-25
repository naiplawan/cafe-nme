import { test, expect, pairAndLogin, openShift, prepareCashSale } from "./fixtures";

// Catches missing modifiers, incorrect change, unpaid refund deductions, and
// omitted/duplicated cash movements in the real browser → API → database flow.
test("cash sale, preparation and partial payout reconcile at shift close", async ({ page, shop }) => {
  await pairAndLogin(page, shop.pairingCode);
  await openShift(page);
  await prepareCashSale(page);
  await page.getByRole("button", { name: "รับเงิน · ทอน ฿60", exact: true }).click();
  await expect(page.getByRole("img", { name: "ชำระเงินสำเร็จ", exact: true })).toBeVisible();
  await expect(page.getByText("฿60", { exact: true })).toBeVisible();

  const { sql, shopId } = shop;
  const orders = await sql`select id,status,total_satang from orders where shop_id=${shopId}`;
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ status: "paid", total_satang: 14_000 });
  const orderId = orders[0].id as string;
  const payments = await sql`select method,amount_satang from payments where order_id=${orderId}`;
  expect(payments).toEqual([{ method: "cash", amount_satang: 14_000 }]);

  await page.getByRole("link", { name: /พิมพ์/ }).click();
  await expect(page).toHaveURL(/\/pos\/receipt\//);
  await expect(page.getByText("ลาเต้ทดสอบ × 2", { exact: true })).toBeVisible();
  await expect(page.getByText("นมโอ๊ต", { exact: true })).toBeVisible();
  await expect(page.getByText("฿140", { exact: true }).first()).toBeVisible();

  await page.goto("/pos/queue");
  await page.getByRole("button", { name: "เริ่มทำ", exact: true }).click();
  await expect(page.getByText("กำลังทำ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "พร้อมเสิร์ฟ", exact: true }).click();
  await page.reload();
  await expect(page.getByText("พร้อมรับแล้ว", { exact: true })).toBeVisible();

  await page.goto("/pos/orders");
  await page.getByRole("link", { name: "คืนเงิน / ยกเลิกรายการที่ชำระแล้ว", exact: true }).click();
  await page.getByLabel("จำนวนคืน ลาเต้ทดสอบ", { exact: true }).fill("1");
  await page.getByLabel("เหตุผล", { exact: true }).fill("ลูกค้าคืนหนึ่งแก้ว");
  await page.getByRole("button", { name: "อนุมัติคืนรายการที่เลือก", exact: true }).click();
  await expect(page.getByRole("heading", { name: "฿70 · รอจ่ายคืน", exact: true })).toBeVisible();

  // Approval alone must not remove money from the drawer.
  await page.goto("/pos/shifts");
  await expect(page.getByText("เงินสดที่ควรมี ฿640", { exact: true })).toBeVisible();
  await page.goto(`/pos/refunds/${orderId}`);
  await page.getByLabel("อ้างอิงการส่งมอบ / โอนคืน", { exact: true }).fill("E2E cash handover");
  await page.getByLabel("ฉันจ่ายเงินจริงคืนให้ลูกค้าแล้ว", { exact: true }).check();
  await page.getByRole("button", { name: "บันทึกการจ่ายคืนจริง", exact: true }).click();
  await expect(page.getByRole("heading", { name: "฿70 · บันทึกว่าจ่ายคืนแล้ว", exact: true })).toBeVisible();
  await expect(page.getByText(/คืนได้อีก 1 \/ 2/)).toBeVisible();

  await page.goto("/pos/shifts");
  await expect(page.getByText("เงินสดที่ควรมี ฿570", { exact: true })).toBeVisible();
  await page.getByLabel("เงินสดที่นับได้ (บาท)").fill("570");
  await page.getByRole("button", { name: "ยืนยันยอดและปิดกะ", exact: true }).click();
  await expect(page.getByText("ควรมี ฿570 · นับได้ ฿570 · ส่วนต่าง ฿0", { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'ดูบัญชีเงินสดและผู้อนุมัติ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บัญชีเงินสดประจำกะ', exact: true })).toBeVisible();
  await expect(page.getByText('ยอดที่บันทึกตอนปิด ฿570 · นับได้ ฿570 · ส่วนต่าง ฿0', { exact: true })).toBeVisible();
  await expect(page.getByText('อ้างอิง: E2E cash handover', { exact: true })).toBeVisible();
  await expect(page.getByText('รายการล่าสุด · 2 รายการ', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'กลับไปกะเงินสด', exact: true }).click();
  await expect(page).toHaveURL(/\/pos\/shifts$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "เปิดกะเงินสด", exact: true })).toBeVisible();
  const shifts = await sql`select expected_cash_satang,counted_cash_satang,closed_at is not null as closed from shifts where shop_id=${shopId}`;
  // postgres preserves bigint as text; counted cash is a PostgreSQL integer.
  expect(shifts).toEqual([{ expected_cash_satang: "57000", counted_cash_satang: 57_000, closed: true }]);
  const refunds = await sql`select amount_satang,payout_method,paid_at is not null as paid from refunds where shop_id=${shopId}`;
  expect(refunds).toEqual([{ amount_satang: 7000, payout_method: "cash", paid: true }]);

  await prepareCashSale(page);
  await page.getByRole("button", { name: "รับเงิน · ทอน ฿60", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("กรุณาเปิดกะและนับเงินทอนก่อนขายเงินสด");
  expect(await sql`select id from orders where shop_id=${shopId}`).toHaveLength(1);
});

// Catches a retry that creates a second order after a committed response is lost.
test("reload recovers a committed cash sale without a second payment", async ({ page, context, shop }) => {
  await pairAndLogin(page, shop.pairingCode);
  await openShift(page);
  await prepareCashSale(page);

  let responseDropped = false;
  let responseStatus = 0;
  await page.route("**/pos", async (route) => {
    const request = route.request();
    if (!responseDropped && request.method() === "POST" && request.headers()["next-action"]
      && request.postData()?.includes("cashReceivedSatang")) {
      // Always resolve the intercepted request, even when the server fails.
      // Assert in the test body so failures report the status, not a UI timeout.
      responseStatus = await route.fetch().then((response) => response.status(), () => 0);
      responseDropped = true;
      await route.abort("failed");
    } else { await route.continue(); }
  });
  await page.getByRole("button", { name: "รับเงิน · ทอน ฿60", exact: true }).click();
  await expect(page.getByRole("button", { name: "ตรวจสอบรายการเดิมอีกครั้ง", exact: true })).toBeVisible();
  expect(responseDropped).toBe(true);
  expect(responseStatus).toBe(200);
  const { sql, shopId } = shop;
  const before = await sql`select id from orders where shop_id=${shopId}`;
  expect(before).toHaveLength(1);
  await page.unroute("**/pos");
  await page.reload();
  await expect(page.getByRole("heading", { name: "พบรายการชำระเงินที่ยังไม่ยืนยัน", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ตรวจสอบรายการเดิมอีกครั้ง", exact: true }).click();
  await expect(page.getByRole("img", { name: "ชำระเงินสำเร็จ", exact: true })).toBeVisible();
  expect(await sql`select id from orders where shop_id=${shopId}`).toEqual(before);
  expect(await sql`select p.amount_satang from payments p join orders o on o.id=p.order_id where o.shop_id=${shopId}`)
    .toEqual([{ amount_satang: 14_000 }]);

  await page.getByRole("button", { name: "เริ่มออเดอร์ใหม่", exact: true }).click();
  await expect(page.getByRole("button", { name: "ชำระเงิน ฿0", exact: true })).toBeDisabled();
  await prepareCashSale(page);
  await page.getByRole("button", { name: "กลับ", exact: true }).click();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "ออฟไลน์ — ชำระเงินไม่ได้", exact: true })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "ชำระเงิน ฿140", exact: true })).toBeEnabled();
});

test('replacement stock, cancellation before preparation, remake and drawer movements stay consistent', async ({ page, shop }) => {
  const { sql, shopId } = shop;
  const [product] = await sql`select id from products where shop_id=${shopId}`;
  const [modifier] = await sql`select m.id from modifiers m join modifier_groups g on g.id=m.group_id where g.shop_id=${shopId}`;
  const [owner] = await sql`select id from staff where shop_id=${shopId} and role='owner'`;
  const [milk] = await sql`insert into ingredients(shop_id,name,unit,average_cost_per_milliunit) values(${shopId},'Milk','ml',0.006) returning id`;
  const [oat] = await sql`insert into ingredients(shop_id,name,unit,average_cost_per_milliunit) values(${shopId},'Oat','ml',0.008) returning id`;
  await sql`update shops set stock_consumption='preparation' where id=${shopId}`;
  for (const ingredient of [milk, oat]) {
    await sql`insert into inventory_movements(shop_id,ingredient_id,kind,quantity_milliunits,actor_staff_id,reason,request_id)
      values(${shopId},${ingredient.id},'receive',1000000,${owner.id},'Opening stock',gen_random_uuid())`;
  }
  await sql`insert into recipe_lines(shop_id,product_id,ingredient_id,quantity_milliunits) values(${shopId},${product.id},${milk.id},200000)`;
  await sql`insert into modifier_recipe_lines(shop_id,modifier_id,ingredient_id,quantity_milliunits,replaces_ingredient_id)
    values(${shopId},${modifier.id},${oat.id},200000,${milk.id})`;
  await pairAndLogin(page, shop.pairingCode);
  await openShift(page);
  await prepareCashSale(page);
  await page.getByRole('button', { name: 'รับเงิน · ทอน ฿60', exact: true }).click();
  await expect(page.getByRole('img', { name: 'ชำระเงินสำเร็จ', exact: true })).toBeVisible();
  const [order] = await sql`select id from orders where shop_id=${shopId}`;
  expect(await sql`select ingredient_id,quantity_milliunits from order_stock_holds where order_id=${order.id}`).toEqual([{ ingredient_id: oat.id, quantity_milliunits: '400000' }]);
  await page.goto(`/pos/refunds/${order.id}`);
  await page.getByLabel('จำนวนคืน ลาเต้ทดสอบ', { exact: true }).fill('1');
  await page.getByLabel('เหตุผล', { exact: true }).fill('Cancel before making');
  await page.getByRole('button', { name: 'อนุมัติคืนรายการที่เลือก', exact: true }).click();
  await expect(page.getByRole('heading', { name: '฿70 · รอจ่ายคืน', exact: true })).toBeVisible();
  await page.goto('/pos/queue');
  await expect(page.getByText('1 × ลาเต้ทดสอบ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'เริ่มทำ', exact: true }).click();
  await expect(page.getByText('กำลังทำ', { exact: true })).toBeVisible();
  await page.getByText('ทำใหม่ (ไม่คิดเงินเพิ่ม)', { exact: true }).click();
  await page.getByLabel('เหตุผล', { exact: true }).fill('Spilled drink');
  await page.getByRole('button', { name: 'บันทึกทำใหม่', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('ไม่เพิ่มยอดขาย');
  expect(await sql`select kind,quantity_milliunits from inventory_movements where order_id=${order.id} order by kind`).toEqual([
    { kind: 'remake', quantity_milliunits: '-200000' }, { kind: 'sale', quantity_milliunits: '-200000' },
  ]);
  expect(await sql`select id from payments where order_id=${order.id}`).toHaveLength(1);
  await page.goto('/pos/shifts');
  await page.getByText('บันทึกเงินเข้า–ออกลิ้นชัก (ผู้จัดการ)', { exact: true }).click();
  for (const [kind, amount, expected] of [['float_topup','100','740'],['petty_cash','20','720'],['bank_deposit','200','520']]) {
    await page.getByRole('combobox', { name: 'ประเภทรายการ', exact: true }).selectOption(kind);
    await page.getByLabel('จำนวนเงิน (บาท)', { exact: true }).fill(amount);
    await page.getByLabel('เหตุผล / เลขที่เอกสาร', { exact: true }).fill(`E2E ${kind}`);
    await page.getByRole('button', { name: 'อนุมัติและบันทึก', exact: true }).click();
    await expect(page.getByText(`เงินสดที่ควรมี ฿${expected}`, { exact: true })).toBeVisible();
  }
  await page.getByLabel('เงินสดที่นับได้ (บาท)').fill('520');
  await page.getByRole('button', { name: 'ยืนยันยอดและปิดกะ', exact: true }).click();
  await expect(page.getByText('ควรมี ฿520 · นับได้ ฿520 · ส่วนต่าง ฿0', { exact: true })).toBeVisible();
});
