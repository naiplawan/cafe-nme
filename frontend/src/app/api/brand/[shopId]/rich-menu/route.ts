import { requireStaff } from "@/lib/auth";
import { renderRichMenuPng } from "@/server/rich-menu-image";

export async function GET(_request: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const [{ shopId }, session] = await Promise.all([params, requireStaff()]);
  if (session.shopId !== shopId) return new Response(null, { status: 404 });
  const png = await renderRichMenuPng(shopId);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
