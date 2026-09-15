import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { signedSheetDownloadUrl } from "@/lib/s3-sheet";

export const dynamic = "force-dynamic";

/** Signed-in download of the S3 workbook. File is not generated here. */
export async function GET() {
  const url = getConfig().DATA_SHEET_URL;
  if (!url) {
    return new NextResponse(
      "Full data sheet is not configured. Set DATA_SHEET_URL.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (/^https:\/\//i.test(url)) {
    return NextResponse.redirect(url, 302);
  }

  try {
    const signed = await signedSheetDownloadUrl(url);
    return NextResponse.redirect(signed, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(message, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
