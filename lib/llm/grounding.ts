import { relevanceTokens } from "../rag/relevance";
import type { RetrievalChunk } from "../rag/types";
import type { QueryFacet, QueryIntent } from "./query-intent";
import { queryScope, queryTopics } from "./query-intent";

const GENERIC_TERMS = new Set([
  "company", "employee", "employees", "share", "shares", "award", "awards",
  "option", "options", "work", "works", "happens", "difference", "private", "general", "equity",
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
  /** Deprecated compatibility field; answer grounding is intentionally uncapped. */
  maxSections?: number;
};

function chunkText(chunk: RetrievalChunk): string {
  // Uploaded filenames are metadata, not evidence. Excluding the title for
  // user-tier chunks prevents a file named "ISO-notes.pdf" from qualifying a
  // response whose extracted text does not actually discuss ISOs.
  return [chunk.tier === "user" ? undefined : chunk.title, chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\b83\s*\(\s*b\s*\)|\b83\s*b\b/g, "83b")
    .replace(/[^a-z0-9]+/g, " ");
}

function terminalHeading(chunk: RetrievalChunk): string {
  return (chunk.headingPath ?? "").split(">").map((part) => part.trim()).filter(Boolean).pop() ?? "";
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
  "offer", "liquidity", "buyback", "secondary", "vesting", "vest", "exercise", "termination",
  "sale", "sell", "sold", "amt", "409a", "83b", "asc", "718",
]);

type ComparisonTopicGroup = {
  key: string;
  terms: string[];
};

/** Identify comparison sides without treating every query word as a column.
 * The groups are deliberately local to grounding so comparison extraction can
 * reuse them without creating a grounding/comparison import cycle. */
export function comparisonTopicGroups(query: string): ComparisonTopicGroup[] {
  const groups: ComparisonTopicGroup[] = [];
  const add = (key: string, terms: string[]) => {
    if (groups.some((group) => group.key === key)) return;
    groups.push({ key, terms: [...new Set(terms.flatMap((term) => relevanceTokens(term)))] });
  };

  const hasIso = /\bisos?\b/i.test(query);
  const hasNso = /\b(?:nsos?|nqsos?)\b/i.test(query);
  if (/\b(?:stock\s+options?|options?)\b/i.test(query) && !hasIso && !hasNso) {
    add("stock options", ["stock", "option", "exercise", "iso", "nso"]);
  }
  if (/\bcash[-\s]?settled\b|\bcash\s+(?:awards?|settlements?)\b/i.test(query)) {
    add("cash-settled awards", ["cash", "settled", "settlement", "sar", "phantom"]);
  }

  for (const topic of queryTopics(query)) {
    if (/^ISO$/i.test(topic)) add("ISO", ["iso"]);
    else if (/^NSO$/i.test(topic)) add("NSO", ["nso"]);
    else add(topic, relevanceTokens(topic));
  }

  // “Compare options and RSUs” has no ISO/NSO label, but “options” is still a
  // meaningful side. Add it here when the phrase was not already handled.
  if (!groups.some((group) => group.key === "stock options") &&
    /\boptions?\b/i.test(query) && !hasIso && !hasNso) {
    add("stock options", ["option", "stock", "exercise", "iso", "nso"]);
  }
  return groups;
}

const AWARD_TERMS = new Set(["iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom"]);

// A section can be directly relevant without repeating the exact topic in its
// final heading. These labels keep that useful coverage while preventing a
// generic section that merely mentions a topic in passing from qualifying.
const TOPIC_LABEL_CONTEXT: Record<string, string[]> = {
  iso: ["iso", "option", "exercise", "tax", "amt", "holding", "disposition", "termination"],
  nso: ["nso", "option", "exercise", "tax", "withholding", "sale", "holding", "termination"],
  rsu: ["rsu", "rsa", "vesting", "vest", "settlement", "release", "delivery", "termination", "liquidity", "tax"],
  rsa: ["rsa", "rsu", "vesting", "vest", "settlement", "release", "delivery", "termination", "liquidity", "tax"],
  espp: ["espp", "purchase", "offering", "discount", "tax", "enrollment", "exercise"],
  psu: ["psu", "performance", "vesting", "vest", "settlement", "accounting", "tax"],
  sar: ["sar", "phantom", "appreciation", "settlement", "exercise", "tax", "409a"],
  phantom: ["phantom", "sar", "appreciation", "settlement", "exercise", "tax", "409a"],
  tender: ["tender", "offer", "liquidity", "exit", "buyback", "secondary", "pricing", "eligibility", "participation", "settlement"],
  offer: ["tender", "offer", "liquidity", "exit", "buyback", "secondary", "pricing", "eligibility", "participation", "settlement"],
  liquidity: ["liquidity", "exit", "tender", "offer", "buyback", "secondary", "sale", "settlement"],
  buyback: ["buyback", "liquidity", "tender", "offer", "sale", "settlement"],
  secondary: ["secondary", "liquidity", "sale", "transfer", "restriction"],
  vesting: ["vesting", "vest", "schedule", "forfeit", "termination", "lifecycle"],
  vest: ["vesting", "vest", "schedule", "forfeit", "termination", "lifecycle"],
  exercise: ["exercise", "option", "payment", "price", "tax", "withholding", "settlement"],
  termination: ["termination", "post-termination", "resignation", "departure", "forfeit", "vesting", "exercise"],
  sale: ["sale", "sell", "disposition", "holding", "capital", "basis", "liquidity", "tax"],
  sell: ["sale", "sell", "disposition", "holding", "capital", "basis", "liquidity", "tax"],
  sold: ["sale", "sell", "disposition", "holding", "capital", "basis", "liquidity", "tax"],
  amt: ["amt", "iso", "exercise", "tax", "basis", "credit"],
  "409a": ["409a", "valuation", "fair", "market", "option", "deferred", "grant", "exercise"],
  "83b": ["83b", "election", "early", "exercise", "vesting", "capital", "holding", "tax"],
  asc: ["asc", "718", "accounting", "fair", "value", "grant", "expense", "recognition", "forfeit", "modification", "dilution", "valuation", "footnote", "disclosure"],
  "718": ["asc", "718", "accounting", "fair", "value", "grant", "expense", "recognition", "forfeit", "modification", "dilution", "valuation", "footnote", "disclosure"],
};

function labelSupportsRequestedTopics(labelTerms: Set<string>, topicTerms: string[]): boolean {
  if (topicTerms.length === 0) return true;
  return topicTerms.some((topic) => {
    if (labelTerms.has(topic)) return true;
    return (TOPIC_LABEL_CONTEXT[topic] ?? []).some((term) => labelTerms.has(term));
  });
}

function isBroadRequest(query: string, intent?: QueryIntent): boolean {
  const scope = intent ? queryScope(intent, query) : "specific";
  // Scope classification already requires an equity-compensation signal for a
  // vague request. Do not demand a particular phrase here, or harmless forms
  // such as “tell me about equity” would fail before the overview path runs.
  return scope === "broad" || scope === "vague";
}

function broadTopicMatch(query: string, chunk: RetrievalChunk): boolean {
  if (chunk.tier === "scrape") return false;
  const value = chunkText(chunk);
  if (chunk.tier === "user") {
    // An uploaded document may supplement a broad answer only when its body
    // contains a meaningful query signal. Its filename is never evidence.
    const queryTerms = relevanceTokens(query).filter((term) => !GENERIC_TERMS.has(term));
    const bodyTerms = new Set(relevanceTokens([chunk.headingPath, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
    return queryTerms.length > 0 && queryTerms.some((term) => bodyTerms.has(term));
  }
  if (/\bequity\s+compensation\b|\bequity\s+award/i.test(query)) return chunk.tier === "curated";
  if (/\bstock\s+options?\b/i.test(query)) {
    if (chunk.tier !== "curated" || !/\b(?:stock|option|iso|nso|exercise)\b/.test(value)) return false;
    const label = `${chunk.title ?? ""} ${chunk.headingPath ?? ""}`.toLowerCase();
    // A section titled only for RSUs, SARs, or phantom equity is adjacent
    // context, not stock-option evidence. Mixed sections remain eligible when
    // the label explicitly includes options or one of the two option types.
    const otherAwardOnly = /\b(?:rsu|rsa|psu|sar|phantom)\b/.test(label) &&
      !/\b(?:option|iso|nso)\b/.test(label);
    return !otherAwardOnly;
  }
  return chunk.tier === "curated";
}

/**
 * Return term groups that must all be present in a candidate section for a
 * focused question. This is deliberately stricter than ordinary lexical
 * overlap: a section about RSU vesting alone is not evidence for what happens
 * to unvested RSUs after termination unless it also discusses termination.
 */
export function evidenceRequirementGroups(query: string, intent?: QueryIntent): string[][] {
  const queryTerms = new Set(relevanceTokens(query));
  const groups: string[][] = [];
  const add = (terms: string[]) => {
    const unique = [...new Set(terms.filter(Boolean))];
    if (unique.length > 0 && !groups.some((group) => group.length === unique.length && group.every((term) => unique.includes(term)))) {
      groups.push(unique);
    }
  };

  for (const topic of intent?.topics ?? []) {
    for (const term of relevanceTokens(topic)) add([term]);
  }
  if (/\btender\s+offer\b/i.test(query)) {
    add(["tender"]);
    add(["offer"]);
  }
  if (/\bdouble[-\s]?trigger\b/i.test(query)) {
    add(["double"]);
    add(["trigger"]);
  }
  if (queryTerms.has("late") || queryTerms.has("deadline") || queryTerms.has("missed") || queryTerms.has("missing")) {
    add(["late", "deadline", "missed", "missing", "30", "extension"]);
  }
  if (queryTerms.has("vest") && queryTerms.has("termination") && queryTerms.has("rsu")) {
    add(["vest", "forfeit", "forfeiture"]);
    add(["termination", "terminate"]);
  }
  if (queryTerms.has("amt") && queryTerms.has("iso") && queryTerms.has("exercise")) {
    add(["exercise"]);
    if (queryTerms.has("sale") || queryTerms.has("sell") || queryTerms.has("sold") || queryTerms.has("hold") || queryTerms.has("held")) {
      add(["sale", "sell", "sold", "hold", "held"]);
    }
  }
  if (queryTerms.has("tax") && queryTerms.has("nso") && (queryTerms.has("exercise") || queryTerms.has("sale") || queryTerms.has("sell") || queryTerms.has("sold"))) {
    add(["tax", "taxes", "taxed", "taxation", "income", "withhold"]);
  }
  if (queryTerms.has("option") && queryTerms.has("409a")) add(["option", "options", "iso", "nso"]);
  if (queryTerms.has("asc") && queryTerms.has("718")) add(["asc", "718", "accounting", "expense"]);
  return groups;
}

export function matchesEvidenceRequirementGroups(text: string, groups: string[][]): boolean {
  if (groups.length === 0) return true;
  const terms = new Set(relevanceTokens(text));
  return groups.every((group) => group.some((term) => terms.has(term)));
}

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
  const heading = `${chunk.headingPath ?? ""} ${chunk.tier === "user" ? "" : chunk.title ?? ""}`.toLowerCase();
  if (/\boverview\b|\bdefinition\b|\bwhat .+\b(?:is|are)\b/.test(heading)) return true;
  return /\b(?:is|are)\s+(?:a|an)\s+(?:type|form|kind|class|contract|right|interest|plan|award|method)\b/i.test(
    chunk.text + " " + (chunk.parentText ?? "")
  );
}

function isPeripheralComparisonSection(query: string, chunk: RetrievalChunk): boolean {
  const label = `${chunk.tier === "user" ? "" : chunk.title ?? ""} ${terminalHeading(chunk)}`.toLowerCase();
  const requested = query.toLowerCase();
  if (/administrator|checklist|form\s+3921|form\s+3922/.test(label) && !/report|filing|form\s+3921|form\s+3922/.test(requested)) return true;
  if (/409a|fair market value|valuation/.test(label) && !/409a|fair market value|valuation/.test(requested)) return true;
  if (/proxy|10-k|10-q|disclosure|securities|rule 144|compliance calendar/.test(label) &&
    !/report|filing|account|disclos|securit|rule\s*144|compliance/.test(requested)) return true;
  if (/professional detail/.test(label) && !/professional|technical|detail/.test(requested)) return true;
  return false;
}

export function isComparisonQuery(query: string): boolean {
  return /\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query);
}

/** A provider response is still required to reflect the evidence selected for
 * this request. This conservative check catches a valid-looking but unrelated
 * model response before it can replace the deterministic Wiki composition. */
export function isGeneratedBodyGrounded(
  query: string,
  body: string,
  chunks: RetrievalChunk[],
  intent?: QueryIntent,
  evidenceTier?: "thin" | "moderate" | "rich" | "very-rich"
): boolean {
  const bodyTerms = new Set(relevanceTokens(body));
  if (bodyTerms.size === 0 || chunks.length === 0) return false;

  const evidenceTerms = new Set(chunks.map(chunkText).flatMap(relevanceTokens));
  const meaningfulQueryTerms = relevanceTokens(query).filter((term) => !GENERIC_TERMS.has(term));
  const directOverlap = meaningfulQueryTerms.filter((term) => bodyTerms.has(term) && evidenceTerms.has(term));
  if (meaningfulQueryTerms.length > 0 && directOverlap.length === 0) return false;

  const topicGroups = isComparisonQuery(query) ? comparisonTopicGroups(query) : [];
  if (topicGroups.length > 1 && topicGroups.some((group) =>
    !group.terms.some((term) => bodyTerms.has(term) && evidenceTerms.has(term)))) return false;

  if (topicGroups.length <= 1) {
    for (const topic of intent?.topics ?? []) {
      const terms = relevanceTokens(topic);
      if (terms.length > 0 && !terms.some((term) => bodyTerms.has(term) && evidenceTerms.has(term))) return false;
    }
  }

  // Rich evidence paired with a one-sentence provider response is a common
  // failure mode. Only reject clearly abnormal brevity; thin evidence remains
  // free to produce a short answer.
  if ((evidenceTier === "rich" || evidenceTier === "very-rich") &&
    body.trim().split(/\s+/).filter(Boolean).length < 40) return false;
  return true;
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
  // Older callers may still pass this field, but the approved generation
  // contract no longer drops relevant sections because of an editorial cap.
  void options.maxSections;
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
  const comparisonGroups = isComparisonQuery(query) ? comparisonTopicGroups(query) : [];
  const comparisonTerms = comparisonGroups.flatMap((group) => group.terms);
  const scoringTopicTerms = [...new Set([...topicTerms, ...comparisonTerms])];
  const broadRequest = isBroadRequest(query, options.intent);
  const focusGroups = evidenceRequirementGroups(query, options.intent);

  const scored = scoped.map<ScoredChunk>((chunk) => {
    const text = chunkText(chunk);
    const lastHeading = terminalHeading(chunk);
    const titleHeading = `${chunk.tier === "user" ? "" : chunk.title ?? ""} ${lastHeading}`;
    const titleHeadingTerms = new Set(relevanceTokens(titleHeading));
    const contentTerms = new Set(relevanceTokens([lastHeading, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
    const terms = new Set(relevanceTokens([titleHeading, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
    const phraseMatches = phrases.filter((phrase) => text.includes(phrase)).length;
    const anchorMatches = anchors.filter((term) => terms.has(term)).length;
    const meaningfulMatches = meaningfulTerms.filter((term) => terms.has(term)).length;
    const topicMatches = scoringTopicTerms.filter((term) => contentTerms.has(term)).length;
    const nonTopicTerms = meaningfulTerms.filter((term) => !scoringTopicTerms.includes(term));
    const nonTopicMatches = nonTopicTerms.filter((term) => contentTerms.has(term)).length;
    const titleTopicTerms = [...TOPIC_TERMS].filter((term) => titleHeadingTerms.has(term));
    const titleAwardTerms = titleTopicTerms.filter((term) => AWARD_TERMS.has(term));
    const requestedAwardTerms = scoringTopicTerms.filter((term) => AWARD_TERMS.has(term));
    const hasRequestedAwardInTitle = titleAwardTerms.some((term) => requestedAwardTerms.includes(term));
    const hasConflictingAwardInTitle = titleAwardTerms.some((term) => !requestedAwardTerms.includes(term));
    const labelSupportsTopics = labelSupportsRequestedTopics(titleHeadingTerms, scoringTopicTerms);
    const facetMatches = facets.reduce((count, facet) => {
      const facetTerms = FACET_TERMS[facet];
      return count + (facetTerms.some((term) => terms.has(term)) ? 1 : 0);
    }, 0);
    const headingMeaningfulMatches = meaningfulTerms.filter((term) => relevanceTokens(lastHeading).includes(term)).length;
    const headingAnchorMatches = anchors.filter((term) => relevanceTokens(lastHeading).includes(term)).length;
    const focusMatch = isComparisonQuery(query) || matchesEvidenceRequirementGroups(chunkText(chunk), focusGroups);
    const comparisonSectionAllowed = !isComparisonQuery(query) || !isPeripheralComparisonSection(query, chunk);
    const topicCompatible = !hasConflictingAwardInTitle || hasRequestedAwardInTitle;
    const comparisonDirect = isComparisonQuery(query) && comparisonGroups.some((group) =>
      group.terms.some((term) => contentTerms.has(term))) && topicCompatible &&
      !isPeripheralComparisonSection(query, chunk);
    const topicDirect = topicMatches > 0 && topicCompatible && labelSupportsTopics &&
      (nonTopicTerms.length === 0 || nonTopicMatches > 0 || phraseMatches > 0);
    // A resolved definition is already hard-scoped to its canonical node.
    // Every reviewed section in that node is eligible to explain the subject;
    // limiting it to headings named "Overview" would discard the technical
    // rules, tax treatment, and exceptions that make the definition useful.
    const definitionDirect = Boolean(definitionNodeId && chunk.nodeId === definitionNodeId);
    const userDirect = chunk.tier === "user" && topicMatches > 0 &&
      (phraseMatches > 0 || meaningfulMatches >= 2 || facetMatches > 0 || isDefinitionEvidence(chunk));
    const direct =
      (broadRequest && broadTopicMatch(query, chunk)) ||
      (focusMatch && comparisonSectionAllowed && (definitionDirect || userDirect || labelSupportsTopics || comparisonDirect) && topicCompatible && (
        definitionDirect ||
        userDirect ||
        phraseMatches > 0 ||
        comparisonDirect ||
        (topicDirect && (headingMeaningfulMatches > 0 || meaningfulMatches >= 2)) ||
        (meaningfulMatches >= 2 && headingMeaningfulMatches > 0 && (topicMatches > 0 || phraseMatches > 0)) ||
        (anchorMatches > 0 && facetMatches > 0 && (headingAnchorMatches > 0 || phraseMatches > 0))
      ));
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
      chunks: selected.map((entry) => entry.chunk),
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
    if (comparisonGroups.length < 2 || comparisonGroups.length > 4) {
      return { chunks: [], answerable: false };
    }
    const selectedEntries: ScoredChunk[] = [];
    const selectedKeys = new Set<string>();
    for (const group of comparisonGroups) {
      const matches = scored.filter((entry) => {
        const terms = new Set(relevanceTokens(chunkText(entry.chunk)));
        return group.terms.some((term) => terms.has(term));
      });
      const orderedMatches = [...matches].sort((left, right) => {
        const labelPriority = (entry: ScoredChunk) => {
          const labelTerms = relevanceTokens(entry.chunk.tier === "user" ? "" : entry.chunk.title ?? "").filter((term) => TOPIC_TERMS.has(term));
          if (group.terms.some((term) => labelTerms.includes(term)) && labelTerms.every((term) => group.terms.includes(term))) return 2;
          return group.terms.some((term) => relevanceTokens(`${entry.chunk.tier === "user" ? "" : entry.chunk.title ?? ""} ${entry.chunk.headingPath ?? ""}`).includes(term)) ? 1 : 0;
        };
        return labelPriority(right) - labelPriority(left) || right.score - left.score;
      });
      if (!orderedMatches.length) return { chunks: [], answerable: false };
      for (const match of orderedMatches) {
        const key = match.chunk.parentId ?? match.chunk.text;
        if (selectedKeys.has(key)) continue;
        selectedEntries.push(match);
        selectedKeys.add(key);
      }
    }
    for (const entry of scored) {
      const key = entry.chunk.parentId ?? entry.chunk.text;
      if (selectedKeys.has(key)) continue;
      if (comparisonGroups.length > 0 && !comparisonGroups.some((group) =>
        group.terms.some((term) => relevanceTokens(chunkText(entry.chunk)).includes(term)))) continue;
      selectedEntries.push(entry);
      selectedKeys.add(key);
    }
    selected = selectedEntries;
  }

  return {
    chunks: selected.map((entry) => entry.chunk),
    answerable: true,
  };
}
