import { NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/aggregations";

export async function GET() {
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
