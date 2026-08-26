import { relevanceTokens } from "../rag/relevance";
import type { RetrievalChunk } from "../rag/types";

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

function chunkText(chunk: RetrievalChunk): string {
  return [chunk.title, chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function phrasesFor(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const phrases = new Set<string>();
  for (let index = 0; index < words.length - 1; index += 1) {
    const pair = words.slice(index, index + 2);
    if (pair.some((word) => DOMAIN_ANCHORS.has(word))) phrases.add(pair.join(" "));
  }
  return [...phrases];
}

function isComparison(query: string): boolean {
  return /\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query);
}

/**
 * Select only material that directly grounds the user's question. This protects
 * both providers from a broad retrieval set that happens to share generic equity
 * vocabulary with a narrow question.
 */
export function selectAnswerGrounding(query: string, chunks: RetrievalChunk[]): GroundingSelection {
  const seen = new Set<string>();
  const deduped = [...chunks]
    .sort((left, right) => (right.cosine ?? 0) - (left.cosine ?? 0))
    .filter((chunk) => {
      const key = chunk.parentId ?? `${chunk.nodeId ?? "none"}:${chunk.text.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const meaningfulTerms = relevanceTokens(query).filter((term) => !GENERIC_TERMS.has(term));
  const anchors = meaningfulTerms.filter((term) => DOMAIN_ANCHORS.has(term) || /\d/.test(term));
  const phrases = phrasesFor(query);

  const scored = deduped.map<ScoredChunk>((chunk) => {
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

  scored.sort((left, right) => right.score - left.score);
  let selected = scored;
  const exactPhraseLead = scored.find((entry) => entry.phraseMatches > 0);
  if (exactPhraseLead?.chunk.nodeId && !isComparison(query)) {
    selected = scored.filter((entry) => entry.chunk.nodeId === exactPhraseLead.chunk.nodeId);
  }

  if (isComparison(query)) {
    const selectedNodes = new Set<string>();
    selected = selected.filter((entry) => {
      const nodeId = entry.chunk.nodeId ?? `source:${entry.chunk.sourceId ?? "none"}`;
      if (selectedNodes.has(nodeId)) return true;
      if (selectedNodes.size >= 3) return false;
      selectedNodes.add(nodeId);
      return true;
    });
  }

  return { chunks: selected.slice(0, 4).map((entry) => entry.chunk), answerable: true };
}
