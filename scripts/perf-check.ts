/**
 * Timing + RSS check for every analytics page loader (Mongo + Node, no HTTP).
 *   npm run perf:check
 */
import { cpuUsage, memoryUsage } from "node:process";
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
import { listCustomers, getCustomer } from "@/lib/customers";
import { searchDirectory, listChannels } from "@/lib/directories";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { getDbCoverage } from "@/lib/sync/coverage";
import { buildChatInsights } from "@/lib/insights/themes";
import { buildChiefBriefing } from "@/lib/insights/briefing";
import { buildInsightActions } from "@/lib/insights/actions";

function rssMb() {
  return Math.round(memoryUsage().rss / 1024 / 1024);
}

function heapMb() {
  return Math.round(memoryUsage().heapUsed / 1024 / 1024);
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const cpu0 = cpuUsage();
  const rss0 = rssMb();
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  const cpu = cpuUsage(cpu0);
  const cpuMs = Math.round((cpu.user + cpu.system) / 1000);
  const rss1 = rssMb();
  console.log(
    `${label.padEnd(42)} ${String(ms).padStart(5)} ms  cpu ${String(cpuMs).padStart(4)} ms  rss ${String(rss0).padStart(4)}→${String(rss1).padStart(4)} MB  heap ${String(heapMb()).padStart(4)} MB`,
  );
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

  console.log("page loaders (query time / process CPU / RSS)");
  console.log("---");

  await time("warmup getKpis default", () => getKpis(def));

  const kDef = await time("/dashboard getKpis default", () => getKpis(def));
  const kYear = await time("/dashboard getKpis year-to-date", () =>
    getKpis(year),
  );
  const kVoice = await time("/insights getKpis+voice", () =>
    getKpis(def, { voice: true }),
  );
  await time("/insights JS briefing", async () => {
    const insights = buildChatInsights(kVoice, def);
    buildChiefBriefing("cx", kVoice, insights, def);
    buildInsightActions(kVoice, "cx", def);
  });
  await time("/data-flow getDbCoverage", () => getDbCoverage());
  await time("/api/sync-status", () => getSyncStatus());
  const list = await time("/conversations list page 1", () =>
    listConversations({ ...year, page: 1, limit: 25 }),
  );
  const customers = await time("/users listCustomers page 1", () =>
    listCustomers({ ...def, page: 1, limit: 25, sort: "last_seen_at" }),
  );
  await time("/api/directories agents", () =>
    searchDirectory({ role: "agent", limit: 40 }),
  );
  await time("/api/directories customers", () =>
    searchDirectory({ role: "user", limit: 40 }),
  );
  await time("/api/directories channels", () => listChannels());

  const id = list.items[0]?.id;
  const userId = customers.items[0]?.id || list.items[0]?.user?.id;
  if (id) {
    await time("/conversations/[id] payload", () => getConversation(id));
    await time("/conversations/[id] + messages", () =>
      getConversation(id, { includeMessages: true }),
    );
    await time("listConversationMessages 40", () =>
      listConversationMessages({ conversationId: id, limit: 40 }),
    );
  }
  if (userId) {
    await time("/users/[id] getCustomer", () => getCustomer(userId));
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
        insightSampled: kVoice.voice.sampled,
        listTotal: list.totalItems,
        customersTotal: customers.totalItems,
        exportConversationsRows: expC.exported,
        exportConversationsTruncated: expC.truncated,
        exportMessagesRows: expM.exported,
        exportMessagesCsvBytes: Buffer.byteLength(expM.csv, "utf8"),
        processRssMb: rssMb(),
        processHeapMb: heapMb(),
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
