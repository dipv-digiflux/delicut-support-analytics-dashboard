import type { ActorType } from "@/lib/db/types";

export function mapActorType(raw: string | null | undefined): ActorType {
  const v = (raw || "").toUpperCase();
  if (v === "USER") return "user";
  if (v === "AGENT") return "agent";
  if (v === "BOT") return "bot";
  return "system";
}

export function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}
