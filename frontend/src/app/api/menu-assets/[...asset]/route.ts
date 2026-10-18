import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { menuAssetObjectKey } from "@/lib/menu-catalog";

export async function GET(_request: Request, context: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await context.params;
  const key = menuAssetObjectKey(asset);
  if (!key) return new Response("Not found", { status: 404 });

  const bucket = process.env.BUCKET;
  const endpoint = process.env.BUCKET_ENDPOINT;
  const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return new Response("Menu asset storage is not configured", { status: 503 });
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
  return new Response(null, {
    status: 307,
    headers: { Location: url, "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
