import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatBaht } from '@/lib/money';
import { findStaffShops } from '@/server/staff-session';
import { salesSummary, type SalesSummary } from '@/server/reports';

type ShopMembership = Awaited<ReturnType<typeof findStaffShops>>[number];
type BranchSales = { shopId: string; name: string; netSatang: number; orders: number };

export function ownerBranchMemberships(shops: ShopMembership[]) {
  return shops.filter((membership) => membership.staff.role === 'owner');
}

export function buildBranchComparisonRows(branches: BranchSales[], activeShopId: string) {
  const highestRevenue = Math.max(0, ...branches.map((branch) => branch.netSatang));
  return branches
    .toSorted((left, right) => right.netSatang - left.netSatang)
    .map((branch) => ({
      ...branch,
      widthPercent: highestRevenue === 0 ? 0 : Math.round((branch.netSatang / highestRevenue) * 100),
      active: branch.shopId === activeShopId,
    }));
}

function BranchComparisonFallback() {
  return (
    <Card aria-label="กำลังโหลดข้อมูลยอดขายรายสาขา">
      <CardContent className="space-y-4 p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export function BranchComparison({
  shops,
  activeShopId,
  from,
  to,
  activeWeeklySales,
}: {
  shops: ShopMembership[];
  activeShopId: string;
  from: string;
  to: string;
  activeWeeklySales: SalesSummary;
}) {
  const owners = ownerBranchMemberships(shops);
  if (owners.length < 2) return null;

  return (
    <Suspense fallback={<BranchComparisonFallback />}>
      <BranchComparisonData
        shops={owners}
        activeShopId={activeShopId}
        from={from}
        to={to}
        activeWeeklySales={activeWeeklySales}
      />
    </Suspense>
  );
}

async function BranchComparisonData({
  shops,
  activeShopId,
  from,
  to,
  activeWeeklySales,
}: {
  shops: ShopMembership[];
  activeShopId: string;
  from: string;
  to: string;
  activeWeeklySales: SalesSummary;
}) {
  const summaries = await Promise.allSettled(
    shops.map((membership) =>
      membership.shopId === activeShopId
        ? Promise.resolve(activeWeeklySales)
        : salesSummary(membership.shopId, from, to),
    ),
  );
  const rows = summaries.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [
          {
            shopId: shops[index].shopId,
            name: shops[index].shop.name,
            netSatang: result.value.netSatang,
            orders: result.value.orders,
          },
        ]
      : [],
  );
  const failedCount = summaries.length - rows.length;
  const comparison = buildBranchComparisonRows(rows, activeShopId);
  const totalRevenue = comparison.reduce((total, branch) => total + branch.netSatang, 0);
  const totalOrders = comparison.reduce((total, branch) => total + branch.orders, 0);

  return (
    <Card data-branch-comparison>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">เทียบยอดขายรายสาขา</h2>
            <p className="mt-1 text-sm text-muted-foreground">ยอดขายสุทธิ 7 วันล่าสุด</p>
          </div>
          <span className="text-xs text-muted-foreground">{comparison.length} สาขา</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{failedCount > 0 ? 'ยอดขายที่โหลดได้' : 'ยอดขายรวม'}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{formatBaht(totalRevenue)}</dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{failedCount > 0 ? 'ออเดอร์ที่โหลดได้' : 'ออเดอร์รวม'}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{totalOrders}</dd>
          </div>
        </dl>

        {comparison.length > 0 ? (
          <ol className="mt-5 space-y-4">
            {comparison.map((branch, index) => (
              <li key={branch.shopId} className="rounded-xl border border-border/70 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-semibold">{branch.name}</span>
                    {branch.active && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        กำลังดูสาขานี้
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatBaht(branch.netSatang)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${branch.widthPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{branch.orders} ออเดอร์</span>
                  <span>{branch.widthPercent}% ของสาขายอดขายสูงสุด</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            ยังโหลดข้อมูลยอดขายไม่ได้ กรุณาลองใหม่อีกครั้ง
          </p>
        )}
        {failedCount > 0 && comparison.length > 0 && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            โหลดข้อมูลไม่ได้ {failedCount} สาขา
          </p>
        )}
      </CardContent>
    </Card>
  );
}
