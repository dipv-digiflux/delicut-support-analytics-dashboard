import { NextRequest, NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const denied = await assertApiAccess(req);
  if (denied) return denied;

  try {
    const data = await getSyncStatus();
    return NextResponse.json({
      data,
      meta: {
        warnings:
          data.state === "never_run"
            ? ["No sync has run yet. Add credentials and run npm run sync."]
            : data.state === "partial"
              ? ["Last sync completed with some failed windows."]
              : data.state === "failed"
                ? ["Last sync failed."]
                : [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "SYNC_STATUS_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
