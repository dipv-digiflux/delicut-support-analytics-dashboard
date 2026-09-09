import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { exportCustomersCsv } from "@/lib/customers";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireApiAuth(req);
  if (denied) return denied;

  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const q =
      req.nextUrl.searchParams.get("q") || filters.q || undefined;
    const result = await exportCustomersCsv({ ...filters, q });
    const brand = getConfig().APP_BRAND_NAME.toLowerCase().replace(/\s+/g, "-");
    const filename = `${brand}-customers-${filters.from}_${filters.to}.csv`;

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Rows": String(result.exported),
        "X-Export-Total-Matched": String(result.totalMatched),
        "X-Export-Truncated": "false",
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
