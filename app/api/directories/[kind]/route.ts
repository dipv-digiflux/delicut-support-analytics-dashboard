import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { searchDirectory, listChannels } from "@/lib/directories";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string }> },
) {
  const denied = await requireApiAuth(req);
  if (denied) return denied;

  const { kind } = await ctx.params;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 40);
  const page = Number(req.nextUrl.searchParams.get("page") || 1);
  const idsRaw = req.nextUrl.searchParams.get("ids");
  const ids = idsRaw
    ? idsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  if (kind === "agents") {
    const result = await searchDirectory({
      role: "agent",
      q,
      limit,
      page,
      ids,
    });
    return NextResponse.json({ data: result });
  }
  if (kind === "customers") {
    const result = await searchDirectory({
      role: "user",
      q,
      limit,
      page,
      ids,
    });
    return NextResponse.json({ data: result });
  }
  if (kind === "channels") {
    if (ids?.length) {
      const all = await listChannels(undefined, 200, 1);
      const want = new Set(ids);
      const items = all.items.filter((i) => want.has(i.id));
      return NextResponse.json({
        data: {
          items,
          total: items.length,
          page: 1,
          limit: items.length,
          hasMore: false,
        },
      });
    }
    const result = await listChannels(q, limit, page);
    return NextResponse.json({ data: result });
  }
  return NextResponse.json({ error: "Unknown directory" }, { status: 404 });
}
