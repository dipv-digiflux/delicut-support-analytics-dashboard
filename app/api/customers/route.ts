import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { listCustomers } from "@/lib/customers";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireApiAuth(req);
  if (denied) return denied;

  const filters = filtersFromSearchParams(req.nextUrl.searchParams);
  const q = req.nextUrl.searchParams.get("q") || filters.q || undefined;
  const result = await listCustomers({ ...filters, q });
  return NextResponse.json({ data: result });
}
