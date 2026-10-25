import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ShiftsService } from '../src/shifts.service.js';
import { createPaymentSettingsFixture } from './payment-settings-fixture.js';

const database = process.env.TEST_DATABASE_URL;
test('cash statements reconcile physical cash and retain closed snapshots and inactive actor names', { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? '');
  try {
    const sql = f.database.connection;
    const shifts = new ShiftsService(f.database as never);
    const shift = await shifts.open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 50000 });
    const [order] = await sql`insert into orders(shop_id,shift_id,daily_no,business_date,status,total_satang)
      values(${f.shopId},${shift.id},1,'2026-10-25','void',10000) returning id`;
    await sql`insert into payments(order_id,method,amount_satang,confirmed_by) values(${order.id},'cash',10000,${f.baristaId}),(${order.id},'promptpay',9000,${f.ownerId})`;
    await sql`insert into refunds(shop_id,order_id,request_id,amount_satang,lines,reason,approved_by)
      values(${f.shopId},${order.id},gen_random_uuid(),1000,'[]','Approved only',${f.ownerId})`;
    await sql`insert into refunds(shop_id,order_id,request_id,amount_satang,lines,reason,approved_by,paid_by,paid_at,payout_method,payout_reference,cash_shift_id)
      values(${f.shopId},${order.id},gen_random_uuid(),2000,'[]','Returned',${f.ownerId},${f.managerId},now(),'cash','Cash returned',${shift.id})`;
    await shifts.recordMovement(f.shopId, f.managerId, shift.id, { requestId: randomUUID(), kind: 'float_topup', amountSatang: 3000, reason: 'Change' });
    await shifts.recordMovement(f.shopId, f.managerId, shift.id, { requestId: randomUUID(), kind: 'petty_cash', amountSatang: 500, reason: 'Ice' });
    await shifts.recordMovement(f.shopId, f.managerId, shift.id, { requestId: randomUUID(), kind: 'bank_deposit', amountSatang: 10000, reason: 'Bank' });
    const closed = await shifts.close(f.shopId, f.ownerId, shift.id, { requestId: randomUUID(), countedCashSatang: 50500, handedToStaffId: f.managerId });
    await sql`update staff set is_active=false where id=${f.managerId}`;
    const statement = await shifts.statement(f.shopId, f.ownerId, shift.id);
    assert.deepEqual(statement.totals, { cashSalesSatang: 10000, cashRefundsSatang: 2000, topupsSatang: 3000, pettyCashSatang: 500, depositsSatang: 10000 });
    assert.equal(statement.ledgerCashSatang, 50500);
    assert.equal(statement.snapshotDifferenceSatang, 0);
    assert.equal(statement.shift.expectedCashSatang, closed.expectedCashSatang);
    assert.equal(statement.handedToName, 'Payment settings manager');
    assert.equal(statement.entryCount, 5);
    assert.equal(statement.entries.find(row => row.kind === 'refund')?.reference, 'Cash returned');
    assert.equal(statement.entries.find(row => row.kind === 'petty_cash')?.actorName, 'Payment settings manager');
    assert.equal(statement.entries.reduce((sum, row) => sum + row.amountSatang, 50000), 50500);
    // Simulate a historical ledger correction outside normal write APIs. Never rewrite the close snapshot.
    await sql`update payments set amount_satang=9000 where order_id=${order.id} and method='cash'`;
    const changed = await shifts.statement(f.shopId, f.ownerId, shift.id);
    assert.equal(changed.shift.expectedCashSatang, 50500);
    assert.equal(changed.ledgerCashSatang, 49500);
    assert.equal(changed.snapshotDifferenceSatang, -1000);
    await assert.rejects(shifts.statement(f.shopId, f.otherShopOwnerId, shift.id), ForbiddenException);
    await assert.rejects(shifts.statement(f.shopId, f.managerId, shift.id), ForbiddenException);
    await assert.rejects(shifts.statement(f.shopId, f.ownerId, randomUUID()), NotFoundException);
    await assert.rejects(shifts.statement(f.shopId, f.ownerId, shift.id, 0), BadRequestException);
  } finally { await f.dispose(); }
});

test('statement pagination never truncates reconciliation totals', { skip: !database }, async () => {
  const f = await createPaymentSettingsFixture(database ?? '');
  try {
    const shifts = new ShiftsService(f.database as never);
    const shift = await shifts.open(f.shopId, f.ownerId, { requestId: randomUUID(), openingFloatSatang: 0 });
    await f.database.connection`insert into cash_movements(shop_id,shift_id,request_id,kind,amount_satang,reason,actor_staff_id,approved_by_staff_id)
      select ${f.shopId},${shift.id},gen_random_uuid(),'float_topup',100,'Pagination',${f.ownerId},${f.ownerId} from generate_series(1,101)`;
    const first = await shifts.statement(f.shopId, f.ownerId, shift.id);
    const second = await shifts.statement(f.shopId, f.ownerId, shift.id, 2);
    assert.equal(first.entries.length, 100);
    assert.equal(second.entries.length, 1);
    assert.equal(first.entryCount, 101);
    assert.equal(first.ledgerCashSatang, 10100);
    assert.deepEqual(first.totals, second.totals);
    assert.equal(new Set([...first.entries, ...second.entries].map(row => row.id)).size, 101);
  } finally { await f.dispose(); }
});
