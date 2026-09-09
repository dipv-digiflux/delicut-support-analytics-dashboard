import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import {
  SESSION_COOKIE,
  isAuthEnabled,
  sessionSecretFromEnv,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * API gate:
 * 1. Valid admin session cookie (when DASHBOARD_ADMIN_PASSWORD is set)
 * 2. Or Authorization: Bearer <DASHBOARD_API_SECRET> / ?api_key=
 * 3. If neither password nor API secret is configured → open (local only)
 */
export async function assertApiAccess(
  req: NextRequest,
): Promise<NextResponse | null> {
  const cfg = getConfig();
  const authOn = isAuthEnabled(cfg);
  const apiSecret = (cfg.DASHBOARD_API_SECRET || "").trim();

  if (!authOn && !apiSecret) return null;

  if (authOn) {
    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySessionToken(
      cookie,
      sessionSecretFromEnv(cfg),
    );
    if (session) return null;
  }

  if (apiSecret) {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : req.nextUrl.searchParams.get("api_key") || "";
    if (token === apiSecret) return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid credentials",
      },
    },
    { status: 401 },
  );
}

/** Alias used by routes — must be awaited */
export const requireApiAuth = assertApiAccess;
