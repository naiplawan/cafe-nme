import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ statement: vi.fn(), session: vi.fn() }));
vi.mock('@/server/shifts', () => ({ getCashStatement: api.statement }));
vi.mock('@/server/pos-session', () => ({ requirePosStaff: api.session }));
vi.mock('next/server', () => ({ connection: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));
const shiftId = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ shopId: 'session-shop', staff: { id: 'session-staff' } });
  api.statement.mockResolvedValue({
    shift: { id: shiftId, openedByName: 'Owner', openedAt: '2026-10-25T01:00:00Z', closedAt: '2026-10-25T09:00:00Z',
      openingFloatSatang: 50000, expectedCashSatang: 57000, countedCashSatang: 57000, differenceSatang: 0 },
    closedByName: 'Owner', handedToName: 'Former manager',
    totals: { cashSalesSatang: 14000, cashRefundsSatang: 7000, topupsSatang: 0, pettyCashSatang: 0, depositsSatang: 0 },
    ledgerCashSatang: 56000, snapshotDifferenceSatang: -1000, page: 1, pageSize: 100, entryCount: 101,
    entries: [{ id: 'entry', kind: 'refund', amountSatang: -7000, occurredAt: '2026-10-25T08:00:00Z',
      actorName: 'Former manager', approvedByName: 'Owner', reason: 'Returned drink', reference: 'Cash handover',
      orderId: '22222222-2222-4222-8222-222222222222', dailyNo: 1, businessDate: '2026-10-25' }],
  });
});
it('renders frozen totals, historical actors, ledger discrepancy and pagination under session scope', async () => {
  const { default: Page } = await import('./page');
  const markup = renderToStaticMarkup(await Page({ params: Promise.resolve({ shiftId }), searchParams: Promise.resolve({}) }));
  expect(api.statement).toHaveBeenCalledWith('session-shop', 'session-staff', shiftId, 1);
  expect(markup).toContain('฿570');
  expect(markup).toContain('Former manager');
  expect(markup).toContain('Cash handover');
  expect(markup).toContain('role="alert"');
  expect(markup).toContain('page=2');
});
it('rejects malformed statement URLs and out-of-range pages before calling the API', async () => {
  const { default: Page } = await import('./page');
  await expect(Page({ params: Promise.resolve({ shiftId: 'invalid' }), searchParams: Promise.resolve({}) })).rejects.toThrow('not found');
  await expect(Page({ params: Promise.resolve({ shiftId }), searchParams: Promise.resolve({ page: '-1' }) })).rejects.toThrow('not found');
  expect(api.statement).not.toHaveBeenCalled();
});
