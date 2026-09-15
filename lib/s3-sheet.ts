import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getConfig } from "@/lib/config";

export function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  const m = uri.trim().match(/^s3:\/\/([^/]+)\/(.+)$/i);
  if (!m) return null;
  const bucket = m[1];
  const key = m[2].replace(/^\/+/, "");
  if (!bucket || !key) return null;
  return { bucket, key };
}

export async function signedSheetDownloadUrl(s3Uri: string): Promise<string> {
  const loc = parseS3Uri(s3Uri);
  if (!loc) {
    throw new Error("DATA_SHEET_URL must be s3://bucket/key.xlsx");
  }
  const cfg = getConfig();
  if (!cfg.AWS_ACCESS_KEY_ID || !cfg.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local");
  }
  const filename = loc.key.split("/").pop() || "freshchat-data.xlsx";
  const client = new S3Client({
    region: cfg.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: cfg.AWS_ACCESS_KEY_ID,
      secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY,
    },
  });
  const command = new GetObjectCommand({
    Bucket: loc.bucket,
    Key: loc.key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(client, command, { expiresIn: 60 });
}
