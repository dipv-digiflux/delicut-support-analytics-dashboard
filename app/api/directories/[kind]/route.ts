import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { searchDirectory, listChannels } from "@/lib/directories";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string }> },
) {
  const denied = requireApiAuth(req);
  if (denied) return denied;

  const { kind } = await ctx.params;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 40);

  if (kind === "agents") {
    const items = await searchDirectory({ role: "agent", q, limit });
    return NextResponse.json({ data: { items } });
  }
  if (kind === "customers") {
    const items = await searchDirectory({ role: "user", q, limit });
    return NextResponse.json({ data: { items } });
  }
  if (kind === "channels") {
    const items = await listChannels(q, limit);
    return NextResponse.json({ data: { items } });
  }
  return NextResponse.json({ error: "Unknown directory" }, { status: 404 });
}
