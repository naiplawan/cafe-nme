import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { shops, staff } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffSession = {
  userId: string;
  email: string | null;
  staff: { id: string; name: string; role: "owner" | "manager" | "barista" };
  shop: { id: string; name: string };
  shopId: string;
};

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
  if (!user) redirect("/login");

  const [row] = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      shopId: shops.id,
      shopName: shops.name,
    })
    .from(staff)
    .innerJoin(shops, eq(staff.shopId, shops.id))
    .where(and(eq(staff.authUserId, user.id), eq(staff.isActive, true)))
    .limit(1);

  if (!row) redirect("/onboarding");

  return {
    userId: user.id,
    email: user.email ?? null,
    staff: { id: row.id, name: row.name, role: row.role },
    shop: { id: row.shopId, name: row.shopName },
    shopId: row.shopId,
  };
});
