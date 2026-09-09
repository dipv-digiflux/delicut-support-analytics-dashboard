import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getConversation,
  listConversations,
} from "@/lib/aggregations";
import { defaultDateRange, parseFilters } from "@/lib/filters";
import { InboxShell } from "@/components/inbox/InboxShell";

export const dynamic = "force-dynamic";

export default async function InboxConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const defaults = defaultDateRange(365);
  const filters = parseFilters({
    ...sp,
    from: sp.from || defaults.from,
    to: sp.to || defaults.to,
    limit: typeof sp.limit === "string" ? sp.limit : "40",
    page: typeof sp.page === "string" ? sp.page : "1",
    sort: "created_at",
    order: "desc",
  });

  const [list, conversation] = await Promise.all([
    listConversations(filters),
    getConversation(id),
  ]);

  if (!conversation) notFound();

  const listQuery = new URLSearchParams();
  Object.entries({
    q: filters.q,
    resolved: filters.resolved,
    agent: filters.agent,
    channel: filters.channel,
    from: filters.from,
    to: filters.to,
  }).forEach(([k, v]) => {
    if (v) listQuery.set(k, String(v));
  });

  return (
    <InboxShell
      activeId={id}
      listQuery={listQuery.toString()}
      totalItems={list.totalItems}
      conversations={list.items.map((c) => ({
        id: c.id,
        name: c.user.name || c.user.email || "Visitor",
        email: c.user.email,
        preview: c.preview || "(no message preview)",
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        channel: c.channel,
        subject: c.subject.label,
        resolved: c.resolved,
        csat: c.csat,
        agentName: c.agent.name,
      }))}
      page={filters.page}
      totalPages={list.totalPages}
      conversation={{
        id: conversation.id,
        createdAt: conversation.createdAt
          ? new Date(conversation.createdAt).toISOString()
          : null,
        resolvedAt: conversation.resolvedAt
          ? new Date(conversation.resolvedAt).toISOString()
          : null,
        resolved: conversation.resolved,
        reopened: conversation.reopened,
        status: conversation.status,
        channel: conversation.channel,
        group: conversation.group,
        conversationUrl: conversation.conversationUrl,
        subject: conversation.subject.label,
        agent: conversation.agent,
        user: conversation.user,
        csat: conversation.csat,
        labels: conversation.labels,
        metrics: conversation.metrics,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          actorType: m.actorType,
          actorName: m.actorName,
          body: m.body,
          createdAt: m.createdAt
            ? new Date(m.createdAt).toISOString()
            : null,
          hasAttachment: m.hasAttachment,
        })),
      }}
    />
  );
}
