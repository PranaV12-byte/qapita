import { relevanceTokens } from "../rag/relevance";
import type { RetrievalChunk } from "../rag/types";
import type { QueryFacet, QueryIntent } from "./query-intent";

const GENERIC_TERMS = new Set([
  "company", "employee", "employees", "share", "shares", "award", "awards",
  "option", "options", "work", "difference", "private", "general", "equity",
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
  topicMatches: number;
  facetMatches: number;
  direct: boolean;
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
  // Uploaded filenames are metadata, not evidence. Excluding the title for
  // user-tier chunks prevents a file named "ISO-notes.pdf" from qualifying a
  // response whose extracted text does not actually discuss ISOs.
  return [chunk.tier === "user" ? undefined : chunk.title, chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function phrasesFor(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const phrases = new Set<string>();
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size);
      if (phrase.some((word) => DOMAIN_ANCHORS.has(word))) {
        phrases.add(phrase.join(" "));
      }
    }
  }
  return [...phrases];
}

const TOPIC_TERMS = new Set([
  "iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom", "tender",
  "liquidity", "buyback", "secondary", "vesting", "exercise", "termination",
  "amt", "409a", "83b",
]);

const FACET_TERMS: Record<QueryFacet, string[]> = {
  process: ["process", "step", "work", "election", "submit", "participate", "method"],
  explanation: ["why", "purpose", "reason", "because", "used"],
  scenario: ["after", "termination", "if", "when", "outcome", "result", "event"],
  tax: ["tax", "amt", "ordinary", "capital", "basis", "income", "409a", "83b"],
  lifecycle: ["grant", "vest", "exercise", "termination", "liquidity", "sale", "settle"],
  timing: ["timing", "date", "deadline", "window", "holding", "period", "term"],
  eligibility: ["eligible", "eligibility", "employee", "holder", "qualify", "qualified"],
  mechanics: ["mechanics", "structure", "method", "process", "payment", "price"],
  withholding: ["withhold", "payroll", "sell", "cover", "remit"],
  reporting: ["report", "form", "w2", "3921", "3922", "file"],
  settlement: ["settle", "delivery", "close", "cash", "shares", "payment"],
};

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
  // `retrieveWith` and `retrieveMulti` already return the hybrid/RRF order.
  // Keep that order here; cosine is a retrieval signal, not a replacement for
  // the retriever's fused score or its optional reranker.
  const deduped = chunks.filter((chunk) => {
      const key = chunk.parentId ?? `${chunk.nodeId ?? "none"}:${chunk.text.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const scoped = definitionNodeId
    ? deduped.filter((chunk) => chunk.tier === "user" || chunk.nodeId === definitionNodeId)
    : deduped;

  const meaningfulTerms = relevanceTokens(query).filter((term) => !GENERIC_TERMS.has(term));
  const anchors = meaningfulTerms.filter((term) => DOMAIN_ANCHORS.has(term) || /\d/.test(term));
  const phrases = phrasesFor(query);
  const facets = options.intent?.facets ?? [];
  const topicTerms = meaningfulTerms.filter((term) => TOPIC_TERMS.has(term));

  const scored = scoped.map<ScoredChunk>((chunk) => {
    const text = chunkText(chunk);
    const titleHeading = `${chunk.tier === "user" ? "" : chunk.title ?? ""} ${chunk.headingPath ?? ""}`;
    const titleHeadingTerms = new Set(relevanceTokens(titleHeading));
    const terms = new Set(relevanceTokens([titleHeading, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
    const phraseMatches = phrases.filter((phrase) => text.includes(phrase)).length;
    const anchorMatches = anchors.filter((term) => terms.has(term)).length;
    const meaningfulMatches = meaningfulTerms.filter((term) => terms.has(term)).length;
    const topicMatches = topicTerms.filter((term) => terms.has(term)).length;
    const titleTopicTerms = [...TOPIC_TERMS].filter((term) => titleHeadingTerms.has(term));
    const hasRequestedTopicInTitle = titleTopicTerms.some((term) => topicTerms.includes(term));
    const hasConflictingTopicInTitle = titleTopicTerms.some((term) => !topicTerms.includes(term));
    const facetMatches = facets.reduce((count, facet) => {
      const facetTerms = FACET_TERMS[facet];
      return count + (facetTerms.some((term) => terms.has(term)) ? 1 : 0);
    }, 0);
    const headingMeaningfulMatches = meaningfulTerms.filter((term) => titleHeadingTerms.has(term)).length;
    const comparisonDirect = isComparisonQuery(query) && topicMatches > 0;
    const topicDirect = topicMatches > 0 && (!hasConflictingTopicInTitle || hasRequestedTopicInTitle);
    const direct =
      phraseMatches > 0 ||
      comparisonDirect ||
      (topicDirect && (headingMeaningfulMatches > 0 || meaningfulMatches >= 2)) ||
      (meaningfulMatches >= 2 && headingMeaningfulMatches > 0) ||
      (anchorMatches > 0 && facetMatches > 0);
    return {
      chunk,
      phraseMatches,
      anchorMatches,
      meaningfulMatches,
      topicMatches,
      facetMatches,
      direct,
      score:
        (direct ? 100 : 0) +
        topicMatches * 28 +
        phraseMatches * 24 +
        headingMeaningfulMatches * 12 +
        facetMatches * 8 +
        anchorMatches * 5 +
        meaningfulMatches * 2 +
        (chunk.score ?? 0) / 100,
    };
  }).filter((entry) => entry.direct);

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

  if (isComparisonQuery(query)) {
    // A comparison is answerable only when at least two and no more than four
    // named, high-signal topics have direct evidence. Otherwise an optional
    // provider could fill an unsupported column even though the fallback
    // composer correctly knows it cannot do so.
    if (topicTerms.length < 2 || topicTerms.length > 4) {
      return { chunks: [], answerable: false };
    }
    const selectedEntries: ScoredChunk[] = [];
    const selectedKeys = new Set<string>();
    for (const topic of topicTerms) {
      const matches = scored.filter((entry) => {
        const terms = new Set(relevanceTokens([entry.chunk.title, entry.chunk.headingPath, entry.chunk.text, entry.chunk.parentText].filter(Boolean).join(" ")));
        return terms.has(topic);
      });
      const match = [...matches].sort((left, right) => {
        const labelPriority = (entry: ScoredChunk) => {
          const labelTerms = relevanceTokens(entry.chunk.title ?? "").filter((term) => TOPIC_TERMS.has(term));
          if (labelTerms.includes(topic) && labelTerms.every((term) => term === topic)) return 2;
          return relevanceTokens(`${entry.chunk.title ?? ""} ${entry.chunk.headingPath ?? ""}`).includes(topic) ? 1 : 0;
        };
        return labelPriority(right) - labelPriority(left) || right.score - left.score;
      })[0];
      if (!match) return { chunks: [], answerable: false };
      if (!selectedKeys.has(match.chunk.parentId ?? match.chunk.text)) {
        selectedEntries.push(match);
        selectedKeys.add(match.chunk.parentId ?? match.chunk.text);
      }
    }
    for (const entry of scored) {
      const key = entry.chunk.parentId ?? entry.chunk.text;
      if (selectedKeys.has(key)) continue;
      if (selectedEntries.length >= 8) break;
      selectedEntries.push(entry);
      selectedKeys.add(key);
    }
    selected = selectedEntries;
  }

  return {
    chunks: selected.slice(0, isComparisonQuery(query) ? 8 : 6).map((entry) => entry.chunk),
    answerable: true,
  };
}
