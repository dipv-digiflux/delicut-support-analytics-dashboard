import { NextRequest, NextResponse } from "next/server";
import { parseFilters, defaultDateRange } from "@/lib/filters";
import { getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  try {
    const defaults = defaultDateRange(30);
    const sp = new URL(req.url).searchParams;
    if (!sp.get("from")) sp.set("from", defaults.from);
    if (!sp.get("to")) sp.set("to", defaults.to);
    const filters = parseFilters(sp);
    const data = await getKpis(filters);
    const sync = await getSyncStatus();
    const cfg = getConfig();

    return NextResponse.json({
      data,
      meta: {
        from: filters.from,
        to: filters.to,
        timezone: cfg.REPORTING_TIMEZONE,
        lastSyncedAt: sync.lastCompletedAt,
        syncState: sync.state,
        warnings: [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "KPI_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
