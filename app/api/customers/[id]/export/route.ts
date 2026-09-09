import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { exportCustomerChatCsv, getCustomer } from "@/lib/customers";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = requireApiAuth(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const result = await exportCustomerChatCsv({
      userId: id,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
    });
    const brand = getConfig().APP_BRAND_NAME.toLowerCase().replace(/\s+/g, "-");
    const safeName = (customer.name || id)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .slice(0, 40);
    const filename = `${brand}-chat-${safeName}.csv`;

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Rows": String(result.exported),
        "X-Export-Total-Matched": String(result.totalMatched),
        "X-Export-Truncated": "false",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
