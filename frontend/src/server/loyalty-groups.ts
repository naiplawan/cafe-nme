import 'server-only';
import { z } from 'zod';
import { internalApiFetch } from './internal-api';
const settingsSchema = z.object({
  shops: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      stampGoal: z.number().int(),
      stampExpiryMonths: z.number().int(),
      groupId: z.uuid().nullable(),
    }),
  ),
  group: z
    .object({
      id: z.uuid(),
      name: z.string(),
      shops: z.array(z.object({ id: z.uuid(), name: z.string(), outstandingRewards: z.number().int().nonnegative() })),
    })
    .nullable(),
});
export type LoyaltyGroupSettings = z.infer<typeof settingsSchema>;
const path = (shopId: string) => `/v1/shops/${encodeURIComponent(shopId)}/loyalty-group`;
export async function getLoyaltyGroups(shopId: string, actorStaffId: string): Promise<LoyaltyGroupSettings> {
  const response = await internalApiFetch(`${path(shopId)}?actorStaffId=${encodeURIComponent(actorStaffId)}`);
  if (!response.ok) {
    throw new Error('Unable to read loyalty group');
  }
  return settingsSchema.parse(await response.json());
}
export async function createLoyaltyGroup(
  shopId: string,
  actorStaffId: string,
  input: { name: string; shopIds: string[] },
): Promise<void> {
  const response = await internalApiFetch(path(shopId), {
    method: 'POST',
    body: JSON.stringify({ actorStaffId, ...input }),
  });
  if (!response.ok) {
    throw new Error('สร้างกลุ่มไม่สำเร็จ ตรวจสอบสิทธิ์เจ้าของ แผน Pro และนโยบายแสตมป์ของทุกสาขา');
  }
}
