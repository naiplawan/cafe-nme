import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { AUTH_COOKIE_NAME, requestAuthApi } from "@/server/auth-api";
import { findStaffSession } from "@/server/staff-session";

export interface StaffSession {
  userId: string;
  email: string | null;
  staff: { id: string; name: string; role: "owner" | "manager" | "barista" };
  shop: { id: string; name: string };
  shopId: string;
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

  const session = await findStaffSession(user.id);
  if (!session) {
    redirect("/onboarding");
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    staff: session.staff,
    shop: session.shop,
    shopId: session.shopId,
  };
});
