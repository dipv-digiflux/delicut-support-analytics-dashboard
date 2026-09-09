import { NextRequest, NextResponse } from "next/server";
import {
  authEnabled,
  checkAdminCredentials,
  issueSession,
} from "@/lib/auth/credentials";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json(
      { error: { message: "Auth is not configured (set DASHBOARD_ADMIN_PASSWORD)" } },
      { status: 400 },
    );
  }

  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const username = String(body.username || "");
  const password = String(body.password || "");
  if (!checkAdminCredentials(username, password)) {
    return NextResponse.json(
      { error: { message: "Invalid username or password" } },
      { status: 401 },
    );
  }

  const token = await issueSession(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
