'use client';
import { useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LoyaltyGroupSettings } from '@/server/loyalty-groups';
import { createGroupAction } from './actions';
export function GroupForm({ shops, currentShopId }: { shops: LoyaltyGroupSettings['shops']; currentShopId: string }) {
  const [state, action, pending] = useActionState(createGroupAction, { message: null });
  const id = useId();
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor={id}>ชื่อกลุ่ม</Label>
        <Input id={id} name="name" required maxLength={80} />
      </div>
      <input type="hidden" name="shopIds" value={currentShopId} />
      <fieldset className="space-y-3">
        <legend className="mb-3 font-semibold">เลือกสาขาที่ใช้แสตมป์ร่วมกัน</legend>
        {shops.map((shop) => (
          <label key={shop.id} className="flex items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              name={shop.id === currentShopId ? undefined : 'shopIds'}
              value={shop.id}
              defaultChecked={shop.id === currentShopId}
              disabled={shop.id === currentShopId || shop.groupId !== null}
              className="mt-1"
            />
            <span>
              {shop.name}
              <span className="block text-sm text-muted-foreground">
                {shop.stampGoal} แสตมป์ต่อรางวัล · อายุ {shop.stampExpiryMonths} เดือน
                {shop.groupId ? ' · อยู่ในกลุ่มแล้ว' : ''}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        ทุกสาขาต้องมีจำนวนแสตมป์ต่อรางวัลและอายุแสตมป์เท่ากัน และมีแผน Pro หรือช่วงทดลองใช้งาน
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังสร้าง…' : 'สร้างกลุ่มตามสาขาที่เลือก'}
      </Button>
      {state.message ? (
        <p role={state.success ? 'status' : 'alert'} className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
