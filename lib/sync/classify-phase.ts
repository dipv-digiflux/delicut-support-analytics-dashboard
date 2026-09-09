import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { classifyConversation } from "@/lib/classify";
import type { SyncRunCounters } from "@/lib/db/types";
import type { Logger } from "@/lib/log/logger";

/**
 * Subject handling:
 * - Always mirror Freshchat resolution label into derived when present (as-is).
 * - Keyword/LLM classification only if CLASSIFY_ENABLED=true (optional helper).
 * - Only touch docs that need it (null derived, version mismatch, or label present).
 */
export async function classifyPending(
  counters: SyncRunCounters,
  logger: Logger,
): Promise<void> {
  const cfg = getConfig();
  const { conversations } = await collections();

  const filter = {
    $or: [
      { derived: null },
      { "derived.classifier_version": { $nin: ["freshchat-label", "none", cfg.CLASSIFIER_VERSION] } },
      // Re-sync label onto derived when resolution exists but derived empty/outdated
      {
        "resolution.label": { $nin: [null, ""] },
        $or: [
          { derived: null },
          { "derived.subject_source": { $ne: "resolution_label" } },
        ],
      },
    ],
  };

  const cursor = conversations.find(filter).project({
    messages: 1,
    resolution: 1,
    is_stub: 1,
    derived: 1,
  });

  let classified = 0;
  let reclassified = 0;

  for await (const conv of cursor) {
    const label = conv.resolution?.label?.trim() || null;
    const sub = conv.resolution?.sub_label?.trim() || null;

    let result;
    if (label) {
      const subject = sub ? `${label} / ${sub}` : label;
      result = {
        subject,
        subject_source: "resolution_label" as const,
        confidence: 1,
        matched_keywords: [],
        classifier_version: "freshchat-label",
        classified_at: new Date(),
      };
    } else if (cfg.CLASSIFY_ENABLED) {
      result = classifyConversation({
        messages: conv.messages || [],
        resolution: conv.resolution ?? null,
        is_stub: Boolean(conv.is_stub),
      });
    } else {
      result = {
        subject: "",
        subject_source: "none" as const,
        confidence: 0,
        matched_keywords: [],
        classifier_version: "none",
        classified_at: new Date(),
      };
    }

    const prev = conv.derived;
    const changed =
      !prev ||
      prev.subject !== result.subject ||
      prev.subject_source !== result.subject_source ||
      prev.classifier_version !== result.classifier_version;

    if (!changed) continue;

    await conversations.updateOne(
      { _id: conv._id },
      { $set: { derived: result } },
    );

    if (!prev) classified++;
    else reclassified++;
  }

  counters.classified += classified;
  counters.reclassified += reclassified;
  logger.info(
    `subjects: ${classified} set, ${reclassified} updated (classify_enabled=${cfg.CLASSIFY_ENABLED})`,
  );
}
