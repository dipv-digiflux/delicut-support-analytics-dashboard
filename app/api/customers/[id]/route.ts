import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getCustomer, listCustomerMessages } from "@/lib/customers";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireApiAuth(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const messages = await listCustomerMessages({
    userId: id,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    before: sp.get("before") || undefined,
    limit: Number(sp.get("limit") || 50) || 50,
  });

  return NextResponse.json({ data: { customer, messages } });
}
