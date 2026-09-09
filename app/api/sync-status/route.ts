import { NextRequest, NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const denied = await assertApiAccess(req);
  if (denied) return denied;

  try {
    const data = await getSyncStatus();
    const warnings: string[] = [];
    if (data.state === "never_run") {
      warnings.push("No sync has run yet. Add credentials and run npm run sync.");
    } else if (data.state === "paused_quota" || data.campaign?.status === "paused_quota") {
      warnings.push(
        "Backfill paused on Extract daily quota. Re-run the same sync:campaign command tomorrow — merged days are skipped.",
      );
    } else if (data.state === "partial") {
      warnings.push(
        "Last sync left pending or failed windows. Re-run sync/campaign to continue from the checkpoint.",
      );
    } else if (data.state === "failed") {
      warnings.push("Last sync failed.");
    }

    return NextResponse.json({
      data,
      meta: { warnings },
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
