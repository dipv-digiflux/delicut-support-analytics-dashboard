import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Send the signed-in user to the S3/CDN workbook. The file is not generated here. */
export async function GET() {
  const url = getConfig().DATA_SHEET_URL;
  if (!url) {
    return new NextResponse(
      "Full data sheet is not configured. Set DATA_SHEET_URL in .env to the S3 link.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  if (!/^https:\/\//i.test(url)) {
    return new NextResponse(
      "DATA_SHEET_URL must be an https:// link.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return NextResponse.redirect(url, 302);
}
