import { NextRequest, NextResponse } from "next/server";
import { listConversationMessages } from "@/lib/aggregations";
import { assertApiAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await assertApiAccess(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const result = await listConversationMessages({
      conversationId: id,
      before: sp.get("before") || undefined,
      limit: Number(sp.get("limit") || 40) || 40,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "MESSAGES_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
