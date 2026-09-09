/** Cookie + session helpers that work in Edge middleware and Node routes. */

export const SESSION_COOKIE = "dc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  u: string;
  exp: number;
};

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return b64url(sig);
}

export function sessionSecretFromEnv(env: {
  DASHBOARD_SESSION_SECRET?: string;
  DASHBOARD_ADMIN_PASSWORD?: string;
  DASHBOARD_ADMIN_USER?: string;
}): string {
  const explicit = (env.DASHBOARD_SESSION_SECRET || "").trim();
  if (explicit) return explicit;
  const pass = (env.DASHBOARD_ADMIN_PASSWORD || "").trim();
  const user = (env.DASHBOARD_ADMIN_USER || "admin").trim();
  // Deterministic fallback so sessions survive restarts without a separate secret
  return `dc:${user}:${pass}:delicut-session-v1`;
}

export function isAuthEnabled(env: {
  DASHBOARD_ADMIN_PASSWORD?: string;
}): boolean {
  return Boolean((env.DASHBOARD_ADMIN_PASSWORD || "").trim());
}

export async function createSessionToken(
  username: string,
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await sign(secret, body);
  if (expected.length !== sig.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== sig[i]) ok = false;
  }
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload?.u || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
