import { NextRequest, NextResponse } from "next/server";
import {
  isAuthEnabled,
  sessionSecretFromEnv,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

export const config = {
  matcher: [
    /*
     * Protect everything except static assets and the login endpoints.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png|login|api/auth).*)",
  ],
};

function envBag() {
  return {
    DASHBOARD_ADMIN_PASSWORD: process.env.DASHBOARD_ADMIN_PASSWORD,
    DASHBOARD_ADMIN_USER: process.env.DASHBOARD_ADMIN_USER,
    DASHBOARD_SESSION_SECRET: process.env.DASHBOARD_SESSION_SECRET,
    DASHBOARD_API_SECRET: process.env.DASHBOARD_API_SECRET,
  };
}

export async function middleware(req: NextRequest) {
  const env = envBag();
  if (!isAuthEnabled(env)) {
    return NextResponse.next();
  }

  const secret = sessionSecretFromEnv(env);
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(cookie, secret);

  // Optional API Bearer still works for scripts when DASHBOARD_API_SECRET is set
  const apiSecret = (env.DASHBOARD_API_SECRET || "").trim();
  if (!session && apiSecret && req.nextUrl.pathname.startsWith("/api/")) {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : req.nextUrl.searchParams.get("api_key") || "";
    if (token === apiSecret) {
      return NextResponse.next();
    }
  }

  if (session) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in required",
        },
      },
      { status: 401 },
    );
  }

  const login = new URL("/login", req.url);
  login.searchParams.set(
    "next",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );
  return NextResponse.redirect(login);
}
