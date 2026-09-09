import { getConfig } from "@/lib/config";
import {
  createSessionToken,
  isAuthEnabled,
  sessionSecretFromEnv,
  verifySessionToken,
} from "@/lib/auth/session";

export function authEnabled(): boolean {
  return isAuthEnabled(getConfig());
}

export function getSessionSecret(): string {
  return sessionSecretFromEnv(getConfig());
}

export function checkAdminCredentials(
  username: string,
  password: string,
): boolean {
  const cfg = getConfig();
  if (!authEnabled()) return false;
  const u = (cfg.DASHBOARD_ADMIN_USER || "admin").trim();
  const p = (cfg.DASHBOARD_ADMIN_PASSWORD || "").trim();
  return username.trim() === u && password === p;
}

export async function issueSession(username: string): Promise<string> {
  return createSessionToken(username.trim(), getSessionSecret());
}

export async function readSession(
  token: string | undefined | null,
): Promise<{ u: string } | null> {
  if (!authEnabled()) return { u: "open" };
  return verifySessionToken(token, getSessionSecret());
}
