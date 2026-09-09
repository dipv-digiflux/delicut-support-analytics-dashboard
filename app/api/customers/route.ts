import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { listCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireApiAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const result = await listCustomers({
    q: sp.get("q") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    page: Math.max(1, Number(sp.get("page") || 1) || 1),
    limit: [10, 25, 50, 100].includes(Number(sp.get("limit")))
      ? Number(sp.get("limit"))
      : 25,
  });
  return NextResponse.json({ data: result });
}
