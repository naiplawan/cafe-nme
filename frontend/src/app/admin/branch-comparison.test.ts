import { describe, expect, it } from 'vitest';
import { buildBranchComparisonRows, ownerBranchMemberships } from './branch-comparison';

describe('branch comparison rows', () => {
  it('sorts branches by revenue and scales bars against the top branch', () => {
    expect(
      buildBranchComparisonRows(
        [
          { shopId: 'a', name: 'Old Town', netSatang: 5000, orders: 3 },
          { shopId: 'b', name: 'Riverside', netSatang: 10000, orders: 7 },
        ],
        'a',
      ),
    ).toEqual([
      { shopId: 'b', name: 'Riverside', netSatang: 10000, orders: 7, widthPercent: 100, active: false },
      { shopId: 'a', name: 'Old Town', netSatang: 5000, orders: 3, widthPercent: 50, active: true },
    ]);
  });

  it('keeps zero sales bars at zero without dividing by zero', () => {
    expect(buildBranchComparisonRows([{ shopId: 'a', name: 'Old Town', netSatang: 0, orders: 0 }], 'a')).toEqual([
      { shopId: 'a', name: 'Old Town', netSatang: 0, orders: 0, widthPercent: 0, active: true },
    ]);
  });

  it('includes revenue comparison only for owner memberships', () => {
    const owner = {
      staff: { id: 'owner', name: 'Owner', role: 'owner' },
      shop: { id: 'a', name: 'Old Town' },
      shopId: 'a',
    } as const;
    const manager = {
      staff: { id: 'manager', name: 'Manager', role: 'manager' },
      shop: { id: 'b', name: 'Riverside' },
      shopId: 'b',
    } as const;
    expect(ownerBranchMemberships([owner, manager])).toEqual([owner]);
  });
});
