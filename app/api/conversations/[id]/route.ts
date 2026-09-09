import { NextRequest, NextResponse } from "next/server";
import { getConversation, getSyncStatus } from "@/lib/aggregations";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json(
        {
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: `Conversation ${id} not found`,
          },
        },
        { status: 404 },
      );
    }
    const sync = await getSyncStatus();
    return NextResponse.json({
      data: { conversation },
      meta: {
        lastSyncedAt: sync.lastCompletedAt,
        isComplete: !conversation.isStub,
        warnings: conversation.isStub
          ? ["Conversation is a stub (CSAT/label arrived before transcript)."]
          : [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "DETAIL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
