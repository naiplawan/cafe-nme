import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findStaffSession } from "@/server/staff-session";

export interface StaffSession {
  userId: string;
  email: string | null;
  staff: { id: string; name: string; role: "owner" | "manager" | "barista" };
  shop: { id: string; name: string };
  shopId: string;
}

/** The signed-in Supabase user, or null. */
export const getUser = cache(async () => {
  // Supabase checks session expiry with Date.now(), so never prerender past this point.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
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
