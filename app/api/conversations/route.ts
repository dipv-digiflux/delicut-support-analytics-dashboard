import { NextRequest, NextResponse } from "next/server";
import { parseFilters, defaultDateRange } from "@/lib/filters";
import { listConversations, getSyncStatus } from "@/lib/aggregations";

export async function GET(req: NextRequest) {
  try {
    const defaults = defaultDateRange(30);
    const sp = new URL(req.url).searchParams;
    if (!sp.get("from")) sp.set("from", defaults.from);
    if (!sp.get("to")) sp.set("to", defaults.to);
    const filters = parseFilters(sp);
    const result = await listConversations(filters);
    const sync = await getSyncStatus();

    return NextResponse.json({
      data: { items: result.items },
      meta: {
        page: filters.page,
        limit: filters.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        sort: filters.sort,
        order: filters.order,
        lastSyncedAt: sync.lastCompletedAt,
        warnings: [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "LIST_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
