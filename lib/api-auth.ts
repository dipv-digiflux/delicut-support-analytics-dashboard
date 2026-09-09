import { NextRequest, NextResponse } from "next/server";

/**
 * Optional API gate. Set DASHBOARD_API_SECRET in .env.local.
 * Clients must send: Authorization: Bearer <secret>
 * If secret is empty, routes stay open (local-dev default).
 */
export function assertApiAccess(req: NextRequest): NextResponse | null {
  const secret = process.env.DASHBOARD_API_SECRET || "";
  if (!secret) return null;

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : req.nextUrl.searchParams.get("api_key") || "";

  if (token !== secret) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid API credentials",
        },
      },
      { status: 401 },
    );
  }
  return null;
}
