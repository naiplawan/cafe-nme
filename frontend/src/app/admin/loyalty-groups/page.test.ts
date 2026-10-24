import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getLoyaltyGroups: vi.fn(), createLoyaltyGroup: vi.fn() }));
const auth = vi.hoisted(() => ({ requireStaff: vi.fn() }));
vi.mock('@/lib/auth', () => auth);
vi.mock('@/server/loyalty-groups', () => api);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import Page from './page';
import { createGroupAction } from './actions';
beforeEach(() => {
  vi.resetAllMocks();
  auth.requireStaff.mockResolvedValue({ shopId: 'shop-a', staff: { id: 'owner', role: 'owner' } });
  api.getLoyaltyGroups.mockResolvedValue({
    shops: [
      { id: 'shop-a', name: 'Branch A', stampGoal: 10, stampExpiryMonths: 12, groupId: null },
      { id: 'shop-b', name: 'Branch B', stampGoal: 10, stampExpiryMonths: 12, groupId: null },
    ],
    group: null,
  });
});
it('requires explicit branches and explains LINE-only immutable sharing', async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('name="shopIds"');
  expect(html).toContain('Branch A');
  expect(html).toContain('Branch B');
  expect(html).toContain('LINE');
  expect(html).toContain('เบอร์โทร');
  expect(html).toContain('ไม่สามารถเปลี่ยนสาขา');
});
it('shows outstanding reward liability per issuer instead of a creation form for an existing group', async () => {
  api.getLoyaltyGroups.mockResolvedValue({
    shops: [],
    group: {
      id: 'group',
      name: 'Our branches',
      shops: [
        { id: 'a', name: 'Branch A', outstandingRewards: 3 },
        { id: 'b', name: 'Branch B', outstandingRewards: 7 },
      ],
    },
  });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('Our branches');
  expect(html).toContain('Branch A');
  expect(html).toContain('7');
  expect(html).toContain('ผู้ออกรางวัล');
  expect(html).not.toContain('name="shopIds"');
});
it('blocks a manager action even if they submit the owner form directly', async () => {
  auth.requireStaff.mockResolvedValue({ shopId: 'shop-a', staff: { id: 'manager', role: 'manager' } });
  const result = await createGroupAction({ message: null }, new FormData());
  expect(result.message).toBeTruthy();
  expect(api.createLoyaltyGroup).not.toHaveBeenCalled();
});
it('creates exactly the explicitly selected branches under the authenticated owner', async () => {
  const data = new FormData();
  data.set('name', 'My group');
  data.append('shopIds', 'shop-a');
  data.append('shopIds', 'shop-b');
  const result = await createGroupAction({ message: null }, data);
  expect(result.success).toBe(true);
  expect(api.createLoyaltyGroup).toHaveBeenCalledWith('shop-a', 'owner', {
    name: 'My group',
    shopIds: ['shop-a', 'shop-b'],
  });
});
