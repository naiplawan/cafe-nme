import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": object.ContentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=300, s-maxage=300",
  });
  if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
  if (object.ETag) headers.set("ETag", object.ETag);

  return new Response(object.Body.transformToWebStream(), { headers });
}
