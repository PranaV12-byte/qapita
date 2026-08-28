import { relevanceTokens } from "../rag/relevance";
import type { RetrievalChunk } from "../rag/types";
import type { QueryIntent } from "./query-intent";

const GENERIC_TERMS = new Set([
  "company", "employee", "share", "award", "option", "work", "difference",
]);

const DOMAIN_ANCHORS = new Set([
  "iso", "nso", "amt", "409a", "83b", "espp", "fica", "fmv", "ipo", "psu",
  "rsu", "rsa", "sar", "w2", "tax", "vest", "exercise", "withhold", "termination",
  "sale", "grant", "acquisition", "tender", "buyback", "liquidity", "secondary",
]);

type ScoredChunk = {
  chunk: RetrievalChunk;
  phraseMatches: number;
  anchorMatches: number;
  meaningfulMatches: number;
  score: number;
};

export type GroundingSelection = {
  chunks: RetrievalChunk[];
  answerable: boolean;
};

export type GroundingOptions = {
  /** Exact canonical node for a simple definition question. */
  definitionNodeId?: string;
  intent?: QueryIntent;
};

function chunkText(chunk: RetrievalChunk): string {
  return [chunk.title, chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function phrasesFor(query: string): string[] {
  const words = relevanceTokens(query).filter((word) => !GENERIC_TERMS.has(word));
  const phrases = new Set<string>();
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size);
      if (phrase.some((word) => DOMAIN_ANCHORS.has(word))) phrases.add(phrase.join(" "));
    }
  }
  return [...phrases];
}

function isDefinitionEvidence(chunk: RetrievalChunk): boolean {
  if (chunk.sectionKind === "summary") return true;
  const heading = `${chunk.headingPath ?? ""} ${chunk.title ?? ""}`.toLowerCase();
  if (/\boverview\b|\bdefinition\b|\bwhat .+\b(?:is|are)\b/.test(heading)) return true;
  return /\b(?:is|are)\s+(?:a|an)\s+(?:type|form|kind|class|contract|right|interest|plan|award|method)\b/i.test(
    chunk.text + " " + (chunk.parentText ?? "")
  );
}

export function isComparisonQuery(query: string): boolean {
  return /\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query);
}

/**
 * Select only material that directly grounds the user's question. This protects
 * both providers from a broad retrieval set that happens to share generic equity
 * vocabulary with a narrow question.
 */
export function selectAnswerGrounding(
  query: string,
  chunks: RetrievalChunk[],
  options: GroundingOptions = {}
): GroundingSelection {
  const seen = new Set<string>();
  const definitionNodeId = options.definitionNodeId ??
    (options.intent?.kind === "definition" ? options.intent.nodeId : undefined);
  const deduped = [...chunks]
    .sort((left, right) => (right.cosine ?? 0) - (left.cosine ?? 0))
    .filter((chunk) => {
      const key = chunk.parentId ?? `${chunk.nodeId ?? "none"}:${chunk.text.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const scoped = definitionNodeId
    ? deduped.filter((chunk) => chunk.nodeId === definitionNodeId)
    : deduped;

  const meaningfulTerms = relevanceTokens(query).filter((term) => !GENERIC_TERMS.has(term));
  const anchors = meaningfulTerms.filter((term) => DOMAIN_ANCHORS.has(term) || /\d/.test(term));
  const phrases = phrasesFor(query);

  const scored = scoped.map<ScoredChunk>((chunk) => {
    const text = chunkText(chunk);
    const terms = new Set(relevanceTokens([chunk.title, chunk.headingPath, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
    const phraseMatches = phrases.filter((phrase) => text.includes(phrase)).length;
    const anchorMatches = anchors.filter((term) => terms.has(term)).length;
    const meaningfulMatches = meaningfulTerms.filter((term) => terms.has(term)).length;
    const direct = phraseMatches > 0 || anchorMatches > 0 || meaningfulMatches >= 2;
    return {
      chunk,
      phraseMatches,
      anchorMatches,
      meaningfulMatches,
      score: (direct ? 100 : 0) + phraseMatches * 30 + anchorMatches * 12 + meaningfulMatches * 3 + (chunk.cosine ?? 0),
    };
  }).filter((entry) => entry.phraseMatches > 0 || entry.anchorMatches > 0 || entry.meaningfulMatches >= 2);

  if (!scored.length) return { chunks: [], answerable: false };

  if (definitionNodeId) {
    const definitionEvidence = scored
      .filter((entry) => isDefinitionEvidence(entry.chunk))
      .sort((left, right) => {
        const leftSummary = left.chunk.sectionKind === "summary" ? 1 : 0;
        const rightSummary = right.chunk.sectionKind === "summary" ? 1 : 0;
        return rightSummary - leftSummary || right.score - left.score;
      });
    if (!definitionEvidence.length) return { chunks: [], answerable: false };

    const selected = [
      ...definitionEvidence,
      ...scored.filter((entry) => !definitionEvidence.includes(entry)),
    ];
    return {
      chunks: selected.slice(0, 4).map((entry) => entry.chunk),
      answerable: true,
    };
  }

  scored.sort((left, right) => right.score - left.score);
  let selected = scored;
  const exactPhraseLead = scored.find((entry) => entry.phraseMatches > 0);
  if (exactPhraseLead?.chunk.nodeId && !isComparisonQuery(query)) {
    selected = scored.filter((entry) => entry.chunk.nodeId === exactPhraseLead.chunk.nodeId);
  }

  if (isComparisonQuery(query)) {
    const selectedNodes = new Set<string>();
    selected = selected.filter((entry) => {
      const nodeId = entry.chunk.nodeId ?? `source:${entry.chunk.sourceId ?? "none"}`;
      if (selectedNodes.has(nodeId)) return true;
      if (selectedNodes.size >= 4) return false;
      selectedNodes.add(nodeId);
      return true;
    });
  }

  return {
    chunks: selected.slice(0, isComparisonQuery(query) ? 8 : 4).map((entry) => entry.chunk),
    answerable: true,
  };
}
