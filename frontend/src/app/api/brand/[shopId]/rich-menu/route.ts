import { z } from "zod";
import { getUser } from "@/lib/auth";
import { renderRichMenuPng } from "@/server/rich-menu-image";
import { findStaffSession } from "@/server/staff-session";

export async function GET(_request: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  if (!z.uuid().safeParse(shopId).success) { return new Response(null, { status: 404 }); }
  const user = await getUser();
  if (!user) { return new Response(null, { status: 401 }); }
  const session = await findStaffSession(user.id, shopId);
  if (!session) { return new Response(null, { status: 404 }); }
  const png = await renderRichMenuPng(shopId);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
