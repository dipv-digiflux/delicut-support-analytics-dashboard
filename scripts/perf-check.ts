/**
 * Timing check for dashboard / list / detail / export (Mongo + Node, no HTTP).
 *   npm run perf:check
 */
import { closeMongo } from "@/lib/db/client";
import {
  exportConversationsCsv,
  exportMessagesCsv,
  getConversation,
  getKpis,
  getSyncStatus,
  listConversationMessages,
  listConversations,
} from "@/lib/aggregations";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  console.log(`${label.padEnd(42)} ${String(ms).padStart(5)} ms`);
  return result;
}

async function main() {
  const def = filtersFromSearchParams({});
  const year = filtersFromSearchParams({
    from: "2026-01-01",
    to: "2026-09-14",
  });
  const twoDays = filtersFromSearchParams({
    from: "2026-09-01",
    to: "2026-09-14",
  });

  await time("warmup getKpis default", () => getKpis(def));

  const kDef = await time("getKpis default range", () => getKpis(def));
  const kYear = await time("getKpis year-to-date", () => getKpis(year));
  await time("getSyncStatus", () => getSyncStatus());
  const list = await time("listConversations page 1", () =>
    listConversations({ ...year, page: 1, limit: 25 }),
  );
  const id = list.items[0]?.id;
  if (id) {
    await time("getConversation (page payload)", () => getConversation(id));
    await time("getConversation + messages", () =>
      getConversation(id, { includeMessages: true }),
    );
    await time("listConversationMessages 40", () =>
      listConversationMessages({ conversationId: id, limit: 40 }),
    );
  }
  const expC = await time("exportConversationsCsv year cap", () =>
    exportConversationsCsv(year),
  );
  const expM = await time("exportMessagesCsv Sep 1–14", () =>
    exportMessagesCsv(twoDays),
  );

  console.log("---");
  console.log(
    JSON.stringify(
      {
        kpiDefaultTotal: kDef.kpis.total,
        kpiYearTotal: kYear.kpis.total,
        listTotal: list.totalItems,
        exportConversationsRows: expC.exported,
        exportConversationsTruncated: expC.truncated,
        exportMessagesRows: expM.exported,
        exportMessagesCsvBytes: Buffer.byteLength(expM.csv, "utf8"),
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => closeMongo())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await closeMongo().catch(() => undefined);
    process.exit(1);
  });
