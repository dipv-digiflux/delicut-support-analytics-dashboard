import { NextRequest, NextResponse } from "next/server";
import { exportConversationsCsv } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { getConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  const denied = await assertApiAccess(req);
  if (denied) return denied;

  try {
    const filters = filtersFromSearchParams(new URL(req.url).searchParams);
    const result = await exportConversationsCsv(filters);
    const brand = getConfig().APP_BRAND_NAME.toLowerCase().replace(/\s+/g, "-");
    const filename = `${brand}-conversations-${filters.from}_${filters.to}.csv`;

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Rows": String(result.exported),
        "X-Export-Total-Matched": String(result.totalMatched),
        "X-Export-Truncated": result.truncated ? "true" : "false",
        "X-Export-Cap": String(result.cap),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
