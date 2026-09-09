import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversation } from "@/lib/aggregations";

export const dynamic = "force-dynamic";

/** Freshchat-inbox style conversation detail */
export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const userDisplay =
    conversation.user.name ||
    conversation.user.email ||
    conversation.user.phone ||
    "Visitor";

  return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-57px)] flex-col bg-[#f4f5f7]">
      {/* Top bar like Freshchat conversation header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/conversations"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Back
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#275ded] text-sm font-semibold text-white">
            {userDisplay.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{userDisplay}</div>
            <div className="text-xs text-slate-500">
              {[conversation.channel, conversation.group]
                .filter(Boolean)
                .join(" · ") || "Freshchat conversation"}
              {conversation.resolved ? " · Resolved" : " · Open"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.csat?.rating != null && (
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              CSAT {conversation.csat.rating}
            </span>
          )}
          {conversation.subject.label !== "(no Freshchat label)" && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {conversation.subject.label}
            </span>
          )}
          {conversation.conversationUrl && (
            <a
              href={conversation.conversationUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Open in Freshchat
            </a>
          )}
        </div>
      </div>

      {conversation.isStub && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Stub — CSAT/label/metric arrived before transcript was synced.
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_300px]">
        {/* Chat thread */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
            {conversation.messages.length === 0 && (
              <div className="text-center text-sm text-slate-400">
                No messages in synced transcript
              </div>
            )}
            {conversation.messages.map((m) => {
              const isUser = m.actorType === "user";
              const isSystem = m.actorType === "system";
              if (isSystem) {
                return (
                  <div
                    key={m.id}
                    className="text-center text-xs text-slate-400"
                  >
                    {m.body || "System event"} ·{" "}
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleString()
                      : ""}
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${isUser ? "justify-start" : "justify-end"}`}
                >
                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-white">
                      {(m.actorName || userDisplay).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      isUser
                        ? "rounded-tl-md bg-white text-slate-800"
                        : m.actorType === "bot"
                          ? "rounded-tr-md bg-teal-600 text-white"
                          : "rounded-tr-md bg-[#275ded] text-white"
                    }`}
                  >
                    <div
                      className={`mb-1 text-[10px] font-medium uppercase tracking-wide ${
                        isUser ? "text-slate-400" : "text-white/70"
                      }`}
                    >
                      {m.actorName || m.actorType}
                      {m.createdAt
                        ? ` · ${new Date(m.createdAt).toLocaleString()}`
                        : ""}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.body || "—"}
                    </div>
                    {m.hasAttachment && (
                      <div
                        className={`mt-1 text-xs ${isUser ? "text-slate-400" : "text-white/70"}`}
                      >
                        Attachment
                      </div>
                    )}
                  </div>
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e4fd6] text-xs font-semibold text-white">
                      {(m.actorName || "A").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right properties panel (Freshchat-like) */}
        <aside className="border-l border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            User properties
          </div>
          <div className="space-y-3 px-4 py-3 text-sm">
            <Prop label="Name" value={conversation.user.name || "—"} />
            <Prop label="Email" value={conversation.user.email || "—"} />
            <Prop label="Phone" value={conversation.user.phone || "—"} />
            <Prop label="User ID" value={conversation.user.id || "—"} mono />
            {Object.entries(conversation.user.properties || {}).map(
              ([k, v]) => (
                <Prop key={k} label={k} value={v == null ? "—" : String(v)} />
              ),
            )}
          </div>

          <div className="border-y border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Conversation
          </div>
          <div className="space-y-3 px-4 py-3 text-sm">
            <Prop label="ID" value={conversation.id} mono />
            <Prop
              label="Created"
              value={
                conversation.createdAt
                  ? new Date(conversation.createdAt).toLocaleString()
                  : "—"
              }
            />
            <Prop
              label="Resolved at"
              value={
                conversation.resolvedAt
                  ? new Date(conversation.resolvedAt).toLocaleString()
                  : "—"
              }
            />
            <Prop label="Agent" value={conversation.agent.name} />
            <Prop label="Channel" value={conversation.channel || "—"} />
            <Prop label="Group" value={conversation.group || "—"} />
            <Prop
              label="Resolution label"
              value={
                conversation.labels[0]
                  ? [conversation.labels[0].category, conversation.labels[0].subcategory]
                      .filter(Boolean)
                      .join(" / ")
                  : "—"
              }
            />
            <Prop
              label="CSAT"
              value={
                conversation.csat?.rating != null
                  ? `${conversation.csat.rating}${conversation.csat.ratingRaw ? ` (raw: ${conversation.csat.ratingRaw})` : ""}`
                  : "Not rated"
              }
            />
            <Prop
              label="CSAT feedback"
              value={conversation.csat?.feedback || "—"}
            />
            <Prop
              label="First response"
              value={fmtDur(conversation.metrics.first_response_time_seconds)}
            />
            <Prop
              label="Resolution time"
              value={fmtDur(conversation.metrics.resolution_time_seconds)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Prop({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`break-words text-slate-800 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function fmtDur(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}
