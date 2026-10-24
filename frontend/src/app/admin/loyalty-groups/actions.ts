'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createLoyaltyGroup } from '@/server/loyalty-groups';
export interface GroupActionState {
  message: string | null;
  success?: boolean;
}
export async function createGroupAction(_state: GroupActionState, data: FormData): Promise<GroupActionState> {
  const session = await requireStaff();
  if (session.staff.role !== 'owner') {
    return { message: 'ต้องใช้บัญชีเจ้าของร้าน' };
  }
  const name = String(data.get('name') ?? '').trim();
  const shopIds = data.getAll('shopIds').filter((value): value is string => typeof value === 'string');
  if (
    !name ||
    name.length > 80 ||
    shopIds.length < 2 ||
    !shopIds.includes(session.shopId) ||
    new Set(shopIds).size !== shopIds.length
  ) {
    return { message: 'กรุณาระบุชื่อและเลือกอย่างน้อย 2 สาขา รวมสาขาปัจจุบัน' };
  }
  try {
    await createLoyaltyGroup(session.shopId, session.staff.id, { name, shopIds });
  } catch {
    return { message: 'สร้างกลุ่มไม่สำเร็จ ตรวจสอบสิทธิ์เจ้าของ แผน Pro และนโยบายแสตมป์ของทุกสาขา' };
  }
  revalidatePath('/admin/loyalty-groups');
  return { message: 'สร้างกลุ่มสะสมแสตมป์แล้ว', success: true };
}
