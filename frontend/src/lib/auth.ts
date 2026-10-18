import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { AUTH_COOKIE_NAME, requestAuthApi } from "@/server/auth-api";
import { findStaffSession, findStaffShops } from "@/server/staff-session";

export const ACTIVE_SHOP_COOKIE_NAME = "cafenme_active_shop";

export interface StaffSession {
  userId: string;
  email: string | null;
  staff: { id: string; name: string; role: "owner" | "manager" | "barista" };
  shop: { id: string; name: string };
  shopId: string;
  shops: Awaited<ReturnType<typeof findStaffShops>>;
}

/** The signed-in application user, or null. */
export const getUser = cache(async () => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const response = await requestAuthApi("/session", { token });
  if (!response.ok) throw new Error(`Nest auth session API returned ${response.status}`);
  const result = await response.json() as { user: { id: string; email: string } | null };
  return result.user;
});

/**
 * Use at the top of every /admin page and Server Action.
 * Redirects to /login when signed out and /onboarding when the user has no shop yet.
 * Every data query must be scoped with the returned shopId.
 */
export const requireStaff = cache(async (): Promise<StaffSession> => {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const shops = await findStaffShops(user.id);
  if (shops.length === 0) {
    redirect("/onboarding");
  }
  const activeShopId = (await cookies()).get(ACTIVE_SHOP_COOKIE_NAME)?.value;
  const selectedMembership = activeShopId
    ? shops.find((membership) => membership.shopId === activeShopId)
    : shops.length === 1 ? shops[0] : undefined;
  if (!selectedMembership) redirect("/select-shop");

  const session = await findStaffSession(user.id, selectedMembership.shopId);
  if (!session) redirect("/select-shop");
  return {
    userId: user.id,
    email: user.email ?? null,
    staff: session.staff,
    shop: session.shop,
    shopId: session.shopId,
    shops,
  };
});
