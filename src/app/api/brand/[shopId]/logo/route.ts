import { z } from "zod";
import { getLogo } from "@/server/brand";

// Public: logos show on LIFF, receipts and LINE. The ?v= query busts the cache on change.
export async function GET(_request: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  if (!z.uuid().safeParse(shopId).success) return new Response(null, { status: 404 });
  const logo = await getLogo(shopId);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
