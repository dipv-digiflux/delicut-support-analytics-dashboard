import { NextRequest, NextResponse } from "next/server";
import { parseFilters, defaultDateRange } from "@/lib/filters";
import { exportConversationsCsv } from "@/lib/aggregations";

export async function GET(req: NextRequest) {
  try {
    const defaults = defaultDateRange(30);
    const sp = new URL(req.url).searchParams;
    if (!sp.get("from")) sp.set("from", defaults.from);
    if (!sp.get("to")) sp.set("to", defaults.to);
    const filters = parseFilters(sp);
    const csv = await exportConversationsCsv(filters);
    const filename = `freshchat-conversations-${filters.from}_${filters.to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
