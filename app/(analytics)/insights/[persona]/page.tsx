import { notFound } from "next/navigation";
import { InsightsView } from "@/components/insights/InsightsView";
import { getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { buildInsightActions } from "@/lib/insights/actions";
import { buildChatInsights } from "@/lib/insights/themes";
import { isInsightPersona } from "@/lib/insights/persona-config";

export const dynamic = "force-dynamic";

export default async function InsightsPersonaPage({
  params,
  searchParams,
}: {
  params: Promise<{ persona: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { persona } = await params;
  if (!isInsightPersona(persona)) notFound();

  const filters = filtersFromSearchParams(await searchParams);
  let data: Awaited<ReturnType<typeof getKpis>> | null = null;
  let sync: Awaited<ReturnType<typeof getSyncStatus>> | null = null;
  let error: string | null = null;

  try {
    [data, sync] = await Promise.all([
      getKpis(filters, { voice: true }),
      getSyncStatus(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const actions = data ? buildInsightActions(data, persona, filters) : [];
  const insights = data
    ? buildChatInsights(data, filters)
    : { sampled: 0, probed: [], tagged: [], quotes: [] };
  const cfg = getConfig();

  return (
    <InsightsView
      persona={persona}
      filters={filters}
      brandName={cfg.APP_BRAND_NAME}
      data={data}
      insights={insights}
      sync={sync}
      error={error}
      actions={actions}
    />
  );
}
