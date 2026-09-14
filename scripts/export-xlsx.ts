/**
 * Excel export from Mongo (multiple tabs + one All-in-one sheet).
 *
 *   npm run export:xlsx
 *   npm run export:xlsx -- --out=exports/freshchat.xlsx
 *   npm run export:xlsx -- --since=2026-01-01 --until=2026-09-15
 *
 * Tabs:
 *   Info            — what’s in this file (counts, filters, sheet guide)
 *   Conversations   — one row per chat (metadata, CSAT, labels, SLA)
 *   Messages        — one row per message (chat fields + Freshchat raw.*)
 *   CSAT            — rated conversations only
 *   Labels          — conversations that have a resolution label
 *   Users           — customers + agents
 *   All             — one row per message with conversation + user + CSAT +
 *                     label + SLA + full message + every raw CSV column
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { closeMongo, collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { collectRawColumnKeys } from "@/lib/export-messages";
import type { Conversation, EmbeddedMessage, User } from "@/lib/db/types";

const EXCEL_CELL_MAX = 32767;

function arg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function cell(v: unknown): string | number | boolean {
  if (v == null) return "";
  if (typeof v === "boolean" || typeof v === "number") {
    return Number.isFinite(v as number) || typeof v === "boolean" ? v : "";
  }
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > EXCEL_CELL_MAX ? `${s.slice(0, EXCEL_CELL_MAX - 1)}…` : s;
}

function iso(d: Date | null | undefined): string {
  return d?.toISOString?.() || "";
}

function createdMatch(since?: Date, until?: Date): Record<string, unknown> {
  if (!since && !until) return {};
  const created_at: Record<string, Date> = {};
  if (since) created_at.$gte = since;
  if (until) created_at.$lt = until;
  return { created_at };
}

function parseDay(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${s} (use YYYY-MM-DD)`);
  }
  if (endOfDay) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function addSheet(
  wb: ExcelJS.stream.xlsx.WorkbookWriter,
  name: string,
  headers: string[],
) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers).commit();
  return {
    write(row: unknown[]) {
      ws.addRow(row.map(cell)).commit();
    },
    async done() {
      await ws.commit();
    },
  };
}

function userName(u: User | undefined): string {
  if (!u) return "";
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
}

const CONV_HEADERS = [
  "conversation_id",
  "created_at",
  "last_message_at",
  "resolved_at",
  "resolved",
  "reopened",
  "status",
  "is_stub",
  "stub_reason",
  "channel_id",
  "channel",
  "group_id",
  "group",
  "user_id",
  "user_ids",
  "agent_id",
  "agent_name",
  "responder_ids",
  "resolution_label",
  "resolution_sub_label",
  "labeled_at",
  "labeled_by_agent_id",
  "derived_subject",
  "derived_source",
  "csat_rating",
  "csat_rating_raw",
  "csat_comment",
  "csat_submitted_at",
  "csat_survey_id",
  "message_count",
  "messages_truncated",
  "has_attachment",
  "attachment_count",
  "actor_user",
  "actor_agent",
  "actor_bot",
  "actor_system",
  "first_response_seconds",
  "resolution_seconds",
  "response_time_seconds",
  "conversation_url",
  "preview",
  "updated_at",
];

function convRow(c: Conversation): unknown[] {
  return [
    c._id,
    iso(c.created_at),
    iso(c.last_message_at),
    iso(c.resolved_at),
    c.resolved,
    c.reopened,
    c.status,
    c.is_stub,
    c.stub_reason,
    c.channel_id,
    c.channel_name,
    c.group_id,
    c.group_name,
    c.primary_user_id,
    (c.user_ids || []).join("|"),
    c.assigned_agent_id,
    c.assigned_agent_name,
    (c.agent_ids || []).join("|"),
    c.resolution?.label,
    c.resolution?.sub_label,
    iso(c.resolution?.labeled_at),
    c.resolution?.labeled_by_agent_id,
    c.derived?.subject,
    c.derived?.subject_source,
    c.csat?.rating,
    c.csat?.rating_raw,
    c.csat?.comment,
    iso(c.csat?.submitted_at),
    c.csat?.survey_id,
    c.message_count,
    c.messages_truncated,
    c.has_attachment,
    c.attachment_count,
    c.actor_counts?.user ?? 0,
    c.actor_counts?.agent ?? 0,
    c.actor_counts?.bot ?? 0,
    c.actor_counts?.system ?? 0,
    c.metrics?.first_response_time_seconds,
    c.metrics?.resolution_time_seconds,
    c.metrics?.response_time_seconds,
    c.conversation_url,
    c.preview_text,
    iso(c.updated_at),
  ];
}

function msgFields(m: EmbeddedMessage | null, rawKeys: string[]): unknown[] {
  if (!m) {
    return [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      false,
      0,
      "",
      "",
      "",
      "",
      ...rawKeys.map(() => ""),
    ];
  }
  const atts = m.attachments || [];
  const raw = m.raw || {};
  return [
    m.message_id,
    iso(m.created_at),
    m.actor_type,
    m.actor_id,
    [m.actor_first_name, m.actor_last_name].filter(Boolean).join(" ").trim(),
    m.actor_email,
    m.message_type,
    m.detailed_message_type,
    m.message_source,
    m.text,
    m.has_attachment,
    atts.length,
    atts.map((a) => a.file_name || "").join("|"),
    atts.map((a) => a.url || "").join("|"),
    JSON.stringify(atts),
    JSON.stringify(raw),
    ...rawKeys.map((k) => raw[k] ?? ""),
  ];
}

const MSG_HEADERS_BASE = [
  "message_id",
  "message_created_at",
  "actor_type",
  "actor_id",
  "actor_name",
  "actor_email",
  "message_type",
  "detailed_message_type",
  "message_source",
  "text",
  "msg_has_attachment",
  "msg_attachment_count",
  "attachment_names",
  "attachment_urls",
  "attachments_json",
  "raw_json",
];

async function main() {
  const cfg = getConfig();
  const since = parseDay(arg("since"));
  const until = parseDay(arg("until"), true);
  const match = createdMatch(since, until);

  const outArg = arg("out");
  const outDir = path.resolve(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.resolve(
    process.cwd(),
    outArg || path.join("exports", `freshchat-${stamp()}.xlsx`),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const { conversations, users } = await collections();
  console.log(
    `[export:xlsx] ${cfg.MONGODB_DB} → ${outPath}` +
      (since || until
        ? ` (created_at ${since?.toISOString() || "…"} → ${until?.toISOString() || "…"})`
        : " (all conversations)"),
  );

  console.log("[export:xlsx] scanning raw CSV columns + counts…");
  let messageCount = 0;
  const rawSample: { raw?: Record<string, string> | null }[] = [];
  const convCursor = conversations.find(match, {
    projection: { messages: 1, message_count: 1 },
    batchSize: 200,
  });
  for await (const c of convCursor) {
    const msgs = (c.messages || []) as EmbeddedMessage[];
    messageCount += msgs.length || c.message_count || 0;
    for (const m of msgs) {
      if (m.raw) rawSample.push({ raw: m.raw });
    }
  }
  const rawKeys = collectRawColumnKeys(rawSample);
  const convCount = await conversations.countDocuments(match);
  const userCount = await users.estimatedDocumentCount();
  console.log(
    `[export:xlsx] conversations=${convCount} messages≈${messageCount} users≈${userCount} rawColumns=${rawKeys.length}`,
  );

  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outPath,
    useStyles: false,
    useSharedStrings: false,
  });

  const info = addSheet(wb, "Info", ["key", "value"]);
  const infoRows: [string, unknown][] = [
    ["exported_at", new Date().toISOString()],
    ["database", cfg.MONGODB_DB],
    ["filter_since", arg("since") || "(none)"],
    ["filter_until", arg("until") || "(none)"],
    ["conversations", convCount],
    ["messages", messageCount],
    ["users", userCount],
    ["freshchat_raw_columns", rawKeys.join(", ")],
    ["", ""],
    ["sheet", "what’s on it"],
    ["Info", "This guide + counts"],
    ["Conversations", "One row per chat — metadata, CSAT, labels, SLA (no message bodies)"],
    ["Messages", "One row per message — text, actors, attachments, Freshchat raw.* columns"],
    ["CSAT", "Only conversations that have a CSAT rating"],
    ["Labels", "Only conversations that have a Freshchat resolution label"],
    ["Users", "Customers and agents from the users collection"],
    [
      "All",
      "One row per message with conversation + customer + CSAT + label + SLA + full message + every raw CSV column. Stub chats with no messages still get one row.",
    ],
  ];
  for (const [k, v] of infoRows) info.write([k, v]);
  await info.done();

  console.log("[export:xlsx] sheet Conversations…");
  const convSheet = addSheet(wb, "Conversations", CONV_HEADERS);
  const convSlim = conversations.find(match, {
    projection: { messages: 0 },
    batchSize: 300,
  });
  let nConv = 0;
  for await (const c of convSlim) {
    convSheet.write(convRow(c as Conversation));
    nConv++;
    if (nConv % 5000 === 0) console.log(`  conversations ${nConv}`);
  }
  await convSheet.done();

  const msgHeaders = [
    "conversation_id",
    "channel",
    "user_id",
    ...MSG_HEADERS_BASE,
    ...rawKeys.map((k) => `raw.${k}`),
  ];
  console.log("[export:xlsx] sheet Messages…");
  const msgSheet = addSheet(wb, "Messages", msgHeaders);
  let nMsg = 0;
  const msgCursor = conversations.find(match, { batchSize: 100 });
  for await (const c of msgCursor) {
    for (const m of (c.messages || []) as EmbeddedMessage[]) {
      msgSheet.write([c._id, c.channel_name, c.primary_user_id, ...msgFields(m, rawKeys)]);
      nMsg++;
    }
    if (nMsg && nMsg % 20000 === 0) console.log(`  messages ${nMsg}`);
  }
  await msgSheet.done();

  console.log("[export:xlsx] sheet CSAT…");
  const csatHeaders = [
    "conversation_id",
    "created_at",
    "channel",
    "agent_id",
    "agent_name",
    "user_id",
    "csat_rating",
    "csat_rating_raw",
    "csat_comment",
    "csat_submitted_at",
    "csat_survey_id",
  ];
  const csatSheet = addSheet(wb, "CSAT", csatHeaders);
  const csatCursor = conversations.find(
    { ...match, "csat.rating": { $ne: null } },
    { projection: { messages: 0 }, batchSize: 300 },
  );
  for await (const c of csatCursor) {
    csatSheet.write([
      c._id,
      iso(c.created_at),
      c.channel_name,
      c.assigned_agent_id,
      c.assigned_agent_name,
      c.primary_user_id,
      c.csat?.rating,
      c.csat?.rating_raw,
      c.csat?.comment,
      iso(c.csat?.submitted_at),
      c.csat?.survey_id,
    ]);
  }
  await csatSheet.done();

  console.log("[export:xlsx] sheet Labels…");
  const labelHeaders = [
    "conversation_id",
    "created_at",
    "channel",
    "agent_id",
    "user_id",
    "resolution_label",
    "resolution_sub_label",
    "labeled_at",
    "labeled_by_agent_id",
    "derived_subject",
    "derived_source",
  ];
  const labelSheet = addSheet(wb, "Labels", labelHeaders);
  const labelCursor = conversations.find(
    {
      ...match,
      $or: [
        { "resolution.label": { $exists: true, $nin: [null, ""] } },
        { "derived.subject": { $exists: true, $nin: [null, ""] } },
      ],
    },
    { projection: { messages: 0 }, batchSize: 300 },
  );
  for await (const c of labelCursor) {
    labelSheet.write([
      c._id,
      iso(c.created_at),
      c.channel_name,
      c.assigned_agent_id,
      c.primary_user_id,
      c.resolution?.label,
      c.resolution?.sub_label,
      iso(c.resolution?.labeled_at),
      c.resolution?.labeled_by_agent_id,
      c.derived?.subject,
      c.derived?.subject_source,
    ]);
  }
  await labelSheet.done();

  console.log("[export:xlsx] sheet Users…");
  const userHeaders = [
    "user_id",
    "role",
    "first_name",
    "last_name",
    "email",
    "phone",
    "reference_id",
    "enrichment_status",
    "first_seen_at",
    "last_seen_at",
    "conversation_count",
    "properties_json",
  ];
  const userSheet = addSheet(wb, "Users", userHeaders);
  const userMap = new Map<string, User>();
  const userCursor = users.find({});
  for await (const u of userCursor) {
    userMap.set(u._id, u);
    userSheet.write([
      u._id,
      u.role,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.reference_id,
      u.enrichment?.status,
      iso(u.stats?.first_seen_at),
      iso(u.stats?.last_seen_at),
      u.stats?.conversation_count,
      JSON.stringify(u.properties || {}),
    ]);
  }
  await userSheet.done();

  const allHeaders = [
    ...CONV_HEADERS,
    "customer_name",
    "customer_email",
    "customer_phone",
    ...MSG_HEADERS_BASE,
    ...rawKeys.map((k) => `raw.${k}`),
  ];
  console.log("[export:xlsx] sheet All (one row per message)…");
  const allSheet = addSheet(wb, "All", allHeaders);
  let nAll = 0;
  const allCursor = conversations.find(match, { batchSize: 80 });
  for await (const c of allCursor) {
    const u = c.primary_user_id ? userMap.get(c.primary_user_id) : undefined;
    const extra = [userName(u), u?.email || "", u?.phone || ""];
    const msgs = (c.messages || []) as EmbeddedMessage[];
    if (!msgs.length) {
      allSheet.write([...convRow(c as Conversation), ...extra, ...msgFields(null, rawKeys)]);
      nAll++;
      continue;
    }
    for (const m of msgs) {
      allSheet.write([
        ...convRow(c as Conversation),
        ...extra,
        ...msgFields(m, rawKeys),
      ]);
      nAll++;
    }
    if (nAll % 20000 === 0) console.log(`  All rows ${nAll}`);
  }
  await allSheet.done();

  await wb.commit();
  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(
    `[export:xlsx] done — ${outPath} (${sizeMb} MB)  conversations=${nConv} messages=${nMsg} allRows=${nAll}`,
  );
}

main()
  .then(() => closeMongo())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("[export:xlsx] failed:", err);
    await closeMongo().catch(() => undefined);
    process.exit(1);
  });
