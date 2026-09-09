import { NextRequest, NextResponse } from "next/server";
import { getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { assertApiAccess } from "@/lib/api-auth";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

export async function GET(req: NextRequest) {
  const denied = assertApiAccess(req);
  if (denied) return denied;

  try {
    const filters = filtersFromSearchParams(new URL(req.url).searchParams);
    const data = await getKpis(filters);
    const sync = await getSyncStatus();
    const cfg = getConfig();

    return NextResponse.json({
      data,
      meta: {
        from: filters.from,
        to: filters.to,
        timezone: filters.timeZone,
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
