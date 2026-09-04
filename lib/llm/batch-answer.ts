import type { Citation, RetrievalChunk } from "../rag/types";
import {
  answerLengthPolicy,
  composeWikiAnswer,
  stripMarkdown,
  type EvidenceProfile,
} from "./answer-composer";
import { PARTIAL_CONTENT_GAP_MESSAGE } from "./query-batch";
import { titleFromQuery } from "./title";
import type { ArtifactResult } from "./types";
import type { QueryIntent } from "./query-intent";

const MAX_BATCH_WORDS = 2_500;
const MAX_BODY_CHARACTERS = 32_000;

export type AnswerPart = {
  query: string;
  intent: QueryIntent;
  profile?: EvidenceProfile;
  chunks: RetrievalChunk[];
  citations: Citation[];
};

export type BatchComposition = ArtifactResult & {
  answerAvailable: boolean;
  supportedPartCount: number;
};

function partTitle(part: AnswerPart): string {
  if (part.intent.kind === "definition") return part.intent.title;
  return titleFromQuery(part.query);
}

function uniqueCitations(parts: AnswerPart[]): Citation[] {
  const seen = new Set<string>();
  return parts.flatMap((part) => part.citations).filter((citation) => {
    const key = `${citation.kind ?? "topic"}:${citation.sourceId ?? citation.nodeId ?? citation.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Give every supported question enough room for a usable answer, then spend
 * the remaining budget where the reviewed evidence is strongest. The cap is
 * applied to complete composed blocks, so no response is cut in mid-sentence.
 */
export function allocateBatchWordBudgets(parts: AnswerPart[]): number[] {
  const supported = parts.map((part, index) => ({ part, index }))
    .filter(({ part }) => Boolean(part.profile && part.chunks.length));
  const budgets = parts.map(() => 0);
  if (!supported.length) return budgets;

  let remaining = MAX_BATCH_WORDS;
  for (const { part, index } of supported) {
    const limit = answerLengthPolicy(part.intent, part.query, part.profile).maxWords;
    const reserved = Math.min(250, limit);
    budgets[index] = reserved;
    remaining -= reserved;
  }

  while (remaining > 0) {
    const eligible = supported.filter(({ part, index }) => {
      return budgets[index] < answerLengthPolicy(part.intent, part.query, part.profile).maxWords;
    });
    if (!eligible.length) break;
    const weight = (part: AnswerPart) => {
      const tierWeight = part.profile?.tier === "very-rich" ? 4 : part.profile?.tier === "rich" ? 3 : part.profile?.tier === "moderate" ? 2 : 1;
      return tierWeight + (part.profile?.coveredFacets.length ?? 0);
    };
    const totalWeight = eligible.reduce((total, item) => total + weight(item.part), 0);
    let spent = 0;
    for (const { part, index } of eligible) {
      const maximum = answerLengthPolicy(part.intent, part.query, part.profile).maxWords;
      const share = Math.max(1, Math.floor((remaining * weight(part)) / totalWeight));
      const addition = Math.min(share, maximum - budgets[index]);
      budgets[index] += addition;
      spent += addition;
    }
    if (!spent) break;
    remaining -= spent;
  }
  return budgets;
}

function withinCharacterLimit(blocks: string[]): string {
  const selected: string[] = [];
  for (const block of blocks) {
    const next = [...selected, block].join("\n\n");
    if (next.length > MAX_BODY_CHARACTERS) break;
    selected.push(block);
  }
  return selected.join("\n\n");
}

/** Builds a single normal artifact for several independently grounded asks. */
export function composeBatchAnswer(parts: AnswerPart[]): BatchComposition {
  const budgets = allocateBatchWordBudgets(parts);
  const blocks: string[] = [];
  let supportedPartCount = 0;

  parts.forEach((part, index) => {
    const composed = part.profile && part.chunks.length
      ? composeWikiAnswer(part.query, part.chunks, part.intent, {
        profile: part.profile,
        maxWords: budgets[index],
      })
      : null;
    const title = partTitle(part);
    if (!composed) {
      blocks.push(`## ${title}\n\n${PARTIAL_CONTENT_GAP_MESSAGE}`);
      return;
    }
    supportedPartCount += 1;
    blocks.push(`## ${title}\n\n${composed.bodyMarkdown}`);
  });

  const bodyMarkdown = withinCharacterLimit(blocks);
  const citations = uniqueCitations(parts.filter((part) => Boolean(part.profile && part.chunks.length)));
  return {
    title: "Answers to your equity compensation questions",
    bodyMarkdown,
    quickShare: stripMarkdown(bodyMarkdown).replace(/\s+/g, " ").trim(),
    citations,
    answerAvailable: supportedPartCount > 0,
    supportedPartCount,
  };
}

export const MAX_MULTI_QUESTION_WORDS = MAX_BATCH_WORDS;
