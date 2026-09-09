import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversation } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { resolveTimeZone } from "@/lib/timezone";
import { ConversationChat } from "@/components/chat/ConversationChat";
import { ExportButton } from "@/components/ExportButton";
import { ChannelBadge } from "@/components/ui/Identity";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const cfg = getConfig();
  const timeZone = resolveTimeZone(
    typeof sp.tz === "string" ? sp.tz : cfg.REPORTING_TIMEZONE,
  );

  const userDisplay =
    conversation.user.name ||
    conversation.user.email ||
    conversation.user.phone ||
    "Customer";

  return (
    <div className="-mx-2 flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/conversations?tz=${timeZone}`}
            className="text-sm text-[var(--brand)] hover:underline"
          >
            ← Conversations
          </Link>
          <h1 className="text-lg font-bold text-[var(--brand-ink)]">
            {userDisplay}
          </h1>
          <ChannelBadge channel={conversation.channel} />
          {conversation.csat?.rating != null && (
            <span className="dc-pill !bg-[var(--brand-soft)] !text-[var(--brand)]">
              CSAT {conversation.csat.rating}
            </span>
          )}
          {conversation.isStub && (
            <span className="text-xs text-amber-700">Stub (no transcript yet)</span>
          )}
        </div>
        {conversation.user.id && (
          <ExportButton
            endpoint={`/api/customers/${conversation.user.id}/export`}
            query=""
            label="Export chat CSV"
          />
        )}
      </div>

      <ConversationChat conversation={conversation} timeZone={timeZone} />
    </div>
  );
}
