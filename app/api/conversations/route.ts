import { NextRequest, NextResponse } from "next/server";
import { listConversations, getSyncStatus } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

export async function GET(req: NextRequest) {
  const denied = assertApiAccess(req);
  if (denied) return denied;

  try {
    const filters = filtersFromSearchParams(new URL(req.url).searchParams);
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
