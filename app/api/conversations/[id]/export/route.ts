import { NextRequest, NextResponse } from "next/server";
import { exportMessagesCsv } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await assertApiAccess(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const filters = filtersFromSearchParams(new URL(req.url).searchParams);
    const result = await exportMessagesCsv(filters, { conversationId: id });
    const brand = getConfig().APP_BRAND_NAME.toLowerCase().replace(/\s+/g, "-");
    const filename = `${brand}-messages-${id.slice(0, 8)}.csv`;

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
