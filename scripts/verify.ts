import { collections, closeMongo, getDb } from "@/lib/db/client";

async function snapshot() {
  const { conversations, users, syncState } = await collections();
  const convs = await conversations
    .find({})
    .project({
      _id: 1,
      updated_at: 1,
      message_count: 1,
      "sources.transcript.hash": 1,
      "sources.csat.hash": 1,
      "sources.label.hash": 1,
      "derived.subject": 1,
    })
    .sort({ _id: 1 })
    .toArray();

  const userDocs = await users
    .find({})
    .project({ _id: 1, "enrichment.hash": 1 })
    .sort({ _id: 1 })
    .toArray();

  const cursors = await syncState.find({}).sort({ _id: 1 }).toArray();

  const digest = {
    conversation_count: convs.length,
    conversations: convs.map((c) => ({
      id: c._id,
      updated_at: c.updated_at?.toISOString?.() || c.updated_at,
      message_count: c.message_count,
      transcript_hash: c.sources?.transcript?.hash || null,
      csat_hash: c.sources?.csat?.hash || null,
      label_hash: c.sources?.label?.hash || null,
      subject: c.derived?.subject || null,
    })),
    user_count: userDocs.length,
    users: userDocs.map((u) => ({
      id: u._id,
      hash: u.enrichment?.hash || null,
    })),
    cursors,
  };

  console.log(JSON.stringify(digest, null, 2));
}

async function checks() {
  const { conversations, syncWindows } = await collections();
  let issues = 0;

  for await (const c of conversations.find({})) {
    const ids = c.messages.map((m) => m.message_id);
    if (new Set(ids).size !== ids.length) {
      console.error(`duplicate message_id in ${c._id}`);
      issues++;
    }
    for (let i = 1; i < c.messages.length; i++) {
      if (c.messages[i].created_at < c.messages[i - 1].created_at) {
        console.error(`unsorted messages in ${c._id}`);
        issues++;
        break;
      }
    }
    if (c.sources?.transcript && c.is_stub) {
      console.error(`stub with transcript: ${c._id}`);
      issues++;
    }
    if (
      c.csat?.rating != null &&
      (c.csat.rating < 1 || c.csat.rating > 5)
    ) {
      console.error(`bad csat rating on ${c._id}: ${c.csat.rating}`);
      issues++;
    }
  }

  const stuck = await syncWindows
    .find({
      status: "submitted",
      submitted_at: { $lte: new Date(Date.now() - 2 * 3600_000) },
    })
    .toArray();
  if (stuck.length) {
    console.error(`stuck submitted windows: ${stuck.length}`);
    issues += stuck.length;
  }

  if (issues === 0) console.log("[verify] all checks passed");
  else console.error(`[verify] ${issues} issue(s)`);
  return issues;
}

async function main() {
  await getDb();
  if (process.argv.includes("--snapshot")) {
    await snapshot();
  } else {
    const n = await checks();
    await closeMongo();
    process.exit(n === 0 ? 0 : 1);
    return;
  }
  await closeMongo();
}

main().catch(async (err) => {
  console.error(err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
