import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { ExportButton } from "@/components/ExportButton";
import { ConversationTable } from "@/components/conversations/ConversationTable";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { listConversations } from "@/lib/aggregations";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { filtersToQuery } from "@/lib/filters";
import { timezoneLabel } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  let result: Awaited<ReturnType<typeof listConversations>> | null = null;
  let error: string | null = null;
  try {
    result = await listConversations(filters);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const qs = filtersToQuery(filters);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {result && (
            <span className="dc-count">
              {result.totalItems >= 1000
                ? `${(result.totalItems / 1000).toFixed(1)}k`
                : result.totalItems}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--brand-ink)]">
              Conversations
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {timezoneLabel(filters.timeZone)} · filters drive export
            </p>
          </div>
        </div>
        <ExportButton query={qs} label="Export CSV" />
      </div>

      <Suspense fallback={null}>
        <FilterBar showSearch />
      </Suspense>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ConversationTable
        items={(result?.items || []).map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt ?? null,
          lastMessageAt: r.lastMessageAt ?? null,
          resolvedAt: r.resolvedAt ?? null,
          channel: r.channel,
          group: r.group,
          status: r.status ?? null,
          user: r.user,
          subject: r.subject,
          resolutionSubLabel: r.resolutionSubLabel ?? null,
          agent: r.agent,
          resolved: r.resolved,
          reopened: r.reopened,
          csat: r.csat,
          csatComment: r.csatComment ?? null,
          messageCount: r.messageCount,
          attachmentCount: r.attachmentCount ?? 0,
          firstResponseSeconds: r.firstResponseSeconds,
          resolutionSeconds: r.resolutionSeconds ?? null,
          preview: r.preview,
          conversationUrl: r.conversationUrl,
          isStub: r.isStub,
        }))}
        timeZone={filters.timeZone}
      />

      {result && (
        <Suspense fallback={null}>
          <PaginationBar
            page={filters.page}
            totalPages={result.totalPages}
            totalItems={result.totalItems}
            limit={filters.limit}
            limits={[10, 20, 25, 50, 100]}
          />
        </Suspense>
      )}
    </div>
  );
}
