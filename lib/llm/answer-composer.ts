import { getNode } from "../content/tree";
import { relevanceTokens } from "../rag/relevance";
import type { RetrievalChunk } from "../rag/types";
import type { QueryFacet, QueryIntent } from "./query-intent";
import { queryScope } from "./query-intent";
import { evidenceRequirementGroups, matchesEvidenceRequirementGroups } from "./grounding";
import {
  TARGET_GENERATED_BODY_CHARACTERS,
} from "./limits";

export { MAX_GENERATED_BODY_CHARACTERS, TARGET_GENERATED_BODY_CHARACTERS } from "./limits";

export type ComposedAnswer = {
  bodyMarkdown: string;
  quickShare: string;
};

export type EvidenceTier = "thin" | "moderate" | "rich" | "very-rich";

/** One complete paragraph or list block selected from a reviewed section. */
export type EvidenceBlock = {
  text: string;
  section: RetrievalChunk;
  heading: string | null;
  coveredFacets: QueryFacet[];
  relevance: number;
};

export type EvidenceProfile = {
  relevantSections: RetrievalChunk[];
  uniqueBlocks: EvidenceBlock[];
  relevantWordCount: number;
  coveredTopics: string[];
  coveredFacets: QueryFacet[];
  tier: EvidenceTier;
};

export type ComposeOptions = {
  /** Reuse the route's already-grounded profile instead of retrieving again. */
  profile?: EvidenceProfile;
  /** Batch answers supply their own question heading. */
  includeOpeningHeading?: boolean;
};

export type AnswerLengthPolicy = {
  /** Retained as a compatibility shape; ordinary prose is not word-limited. */
  targetWords: number;
  /** Always Infinity. The generated-body guard is character-based instead. */
  maxWords: number;
  /** Always Infinity. Headings are driven by evidence structure. */
  maxHeadings: number;
};

const FACET_HEADING_TERMS: Record<QueryFacet, string[]> = {
  process: ["process", "steps", "method", "election", "participate", "submission"],
  explanation: ["why", "purpose", "reason", "benefit", "used"],
  scenario: ["after", "termination", "event", "outcome", "result", "change"],
  tax: ["tax", "amt", "basis", "income", "withholding", "409a", "83b"],
  lifecycle: ["grant", "vesting", "vest", "exercise", "termination", "liquidity", "sale", "settlement"],
  timing: ["timing", "date", "deadline", "window", "holding", "period", "term"],
  eligibility: ["eligible", "eligibility", "qualify", "qualified", "holder", "recipient"],
  mechanics: ["mechanics", "structure", "payment", "price", "method"],
  withholding: ["withholding", "withhold", "payroll", "sell-to-cover", "remit"],
  reporting: ["reporting", "report", "form", "file", "w-2", "3921", "3922"],
  settlement: ["settlement", "settle", "delivery", "close", "payment", "cash"],
};

const BLOCK_QUERY_NOISE = new Set([
  "happens", "thing", "things", "really", "later", "based", "apply", "applies",
  "may", "might", "could", "would", "should", "often", "typically", "generally",
]);

const PRIMARY_TOPIC_TERMS = new Set([
  "iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom", "tender", "offer",
  "liquidity", "buyback", "secondary", "83b", "409a", "asc", "718",
]);
const AWARD_TOPIC_TERMS = new Set(["iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom"]);

function plainKey(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes the Markdown subset supported by the answer surfaces. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "")
    .trim();
}

function cleanBlock(block: string): string {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.replace(/<\/?[A-Za-z][^>]*>/g, "").trim())
    .filter(Boolean);
  if (!lines.length) return "";

  // Keep list markers and their line structure. Ordinary wrapped paragraphs
  // are joined so a source line break cannot become a visually broken answer.
  const isList = lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line));
  let cleaned = (isList ? lines.join("\n") : lines.join(" ")).trim();
  if (!cleaned) return "";
  const boldMarkers = cleaned.match(/\*\*/g)?.length ?? 0;
  if (boldMarkers % 2 !== 0) cleaned = cleaned.replace(/\*\*/g, "");
  // A malformed source line can leave one quote after the final sentence.
  // Repair only that unpaired terminal mark; quoted technical terms inside the
  // paragraph remain untouched.
  const quoteCount = cleaned.match(/"/g)?.length ?? 0;
  if (quoteCount % 2 !== 0) cleaned = cleaned.replace(/"\s*$/, "").trim();
  // A few legacy content blocks end with a colon followed by an unmatched
  // quote. Keep the terminal colon, but do not let that source typo reach the
  // answer renderer as visibly broken punctuation.
  cleaned = cleaned.replace(/([,:;])\s*(?:\\)?"$/, "$1").trim();
  return cleaned;
}

function removeLeadingQuestionEcho(block: string, query: string): string {
  const question = query.replace(/\s+/g, " ").trim().replace(/[?!.]+$/, "").trim();
  if (!question) return block;
  const escaped = question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const prefix = new RegExp(`^\\s*(?:\\*\\*|__)?\\s*${escaped}\\s*[?!.:]?\\s*(?:\\*\\*|__)?\\s*`, "i");
  const withoutEcho = block.replace(prefix, "").trim();
  return withoutEcho || block;
}

/** Parse complete paragraphs and list groups from a parent section. */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let currentList: "unordered" | "ordered" | null = null;

  const flush = () => {
    const block = cleanBlock(current.join("\n"));
    if (block && !/^(?:sources?|references?)\s*:?$/i.test(stripMarkdown(block))) {
      blocks.push(block);
    }
    current = [];
    currentList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^<\/?[A-Za-z][^>]*>$/.test(trimmed)) continue;

    const listKind = /^[-*]\s+/.test(trimmed)
      ? "unordered"
      : /^\d+[.)]\s+/.test(trimmed)
        ? "ordered"
        : null;
    if (listKind && current.length > 0 && currentList !== listKind) flush();
    if (!listKind && currentList) flush();
    if (listKind) currentList = listKind;
    current.push(trimmed);
  }
  flush();
  return blocks.filter((block, index) => {
    if (!/[:;](?:\\)?["']?$/.test(block.trim())) return true;
    const next = blocks[index + 1]?.trim() ?? "";
    // Keep a normal introductory colon when the source actually supplies the
    // list it introduces. A dangling terminal colon is an incomplete source
    // fragment and should not become a broken answer paragraph.
    return /^(?:[-*]|\d+[.)])\s+/.test(next);
  });
}

function sectionTitle(chunk: RetrievalChunk): string | null {
  const heading = (chunk.headingPath ?? "")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  if (!heading || /^(?:overview|faq)$/i.test(heading)) return null;
  return heading.replace(/[\s:.]+$/, "").trim() || null;
}

function sectionScore(chunk: RetrievalChunk, intent: QueryIntent, query: string): number {
  const heading = `${chunk.tier === "user" ? "" : chunk.title ?? ""} ${chunk.headingPath ?? ""}`.toLowerCase();
  const evidenceTerms = new Set(relevanceTokens([
    chunk.tier === "user" ? undefined : chunk.title,
    chunk.headingPath,
    chunk.text,
    chunk.parentText,
  ].filter(Boolean).join(" ")));
  const queryMatches = relevanceTokens(query).filter((term) => evidenceTerms.has(term)).length;
  const facets = intent.facets ?? [];
  const facetMatches = facets.reduce((count, facet) => {
    return count + (FACET_HEADING_TERMS[facet].some((term) => heading.includes(term)) ? 1 : 0);
  }, 0);
  const summaryBoost = chunk.sectionKind === "summary" ? 24 : 0;
  const faqBoost = chunk.sectionKind === "faq" && queryMatches >= 2 ? 14 : 0;
  const directNodeBoost = intent.kind === "definition" && chunk.nodeId === intent.nodeId ? 18 : 0;
  return summaryBoost + directNodeBoost + facetMatches * 12 + queryMatches * 3 + faqBoost + (chunk.score ?? 0) / 100;
}

function sectionPosition(chunk: RetrievalChunk): number {
  const parentId = chunk.parentId ?? "";
  if (parentId.endsWith("#summary")) return -1;
  const faq = parentId.match(/#faq-(\d+)$/);
  if (faq) return 10_000 + Number(faq[1]);
  const section = parentId.match(/#(\d+)$/);
  return section ? Number(section[1]) : 0;
}

function nodeOrder(chunk: RetrievalChunk): number {
  const node = chunk.nodeId ? getNode(chunk.nodeId) : undefined;
  return node?.pillar ?? 99;
}

function broadSectionCategory(chunk: RetrievalChunk): number {
  const value = `${chunk.tier === "user" ? "" : chunk.title ?? ""} ${chunk.headingPath ?? ""}`.toLowerCase();
  if (/overview|definition|what .+ are|what .+ is|purpose|why .+ exist/.test(value)) return 1;
  if (/award|option|rsu|rsa|espp|psu|sar|phantom|instrument/.test(value)) return 2;
  if (/eligib|grant|accept|plan design|share pool/.test(value)) return 3;
  if (/vest|lifecycle|exercise|settle|release|delivery/.test(value)) return 4;
  if (/tax|amt|withhold|report|basis|409a|83\(?b\)?/.test(value)) return 5;
  if (/account|asc 718|eps|dilution|expense|forfeit/.test(value)) return 6;
  if (/liquid|termination|sale|exit|consequence|resale/.test(value)) return 7;
  if (/exception|practical|consider|compliance|reporting/.test(value)) return 8;
  return 9;
}

function orderSections(sections: RetrievalChunk[], intent: QueryIntent, query: string): RetrievalChunk[] {
  const scope = queryScope(intent, query);
  if (scope !== "broad" && scope !== "vague") {
    return [...sections].sort((left, right) => {
      if (left.nodeId === right.nodeId) return sectionPosition(left) - sectionPosition(right);
      return 0;
    });
  }

  return [...sections].sort((left, right) =>
    broadSectionCategory(left) - broadSectionCategory(right) ||
    nodeOrder(left) - nodeOrder(right) ||
    sectionPosition(left) - sectionPosition(right)
  );
}

function dedupeSections(chunks: RetrievalChunk[], intent: QueryIntent, query: string): RetrievalChunk[] {
  const seen = new Set<string>();
  const ranked = [...chunks]
    .filter((chunk) => chunk.tier !== "scrape")
    .sort((left, right) => sectionScore(right, intent, query) - sectionScore(left, intent, query));
  const unique = ranked.filter((chunk) => {
    const key = chunk.parentId ?? `${chunk.nodeId ?? "none"}:${plainKey(chunk.text).slice(0, 120)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return orderSections(unique, intent, query);
}

function facetTerms(facet: QueryFacet): Set<string> {
  return new Set(relevanceTokens(FACET_HEADING_TERMS[facet].join(" ")));
}

function blockFacetMatches(block: string, intent: QueryIntent): QueryFacet[] {
  const terms = new Set(relevanceTokens(stripMarkdown(block)));
  return (intent.facets ?? []).filter((facet) => {
    return [...facetTerms(facet)].some((term) => terms.has(term));
  });
}

function blockRelevance(block: string, section: RetrievalChunk, query: string, intent: QueryIntent): number {
  const blockTerms = new Set(relevanceTokens(stripMarkdown(block)));
  const queryMatches = relevanceTokens(query).filter((term) => blockTerms.has(term)).length;
  const facetMatches = blockFacetMatches(block, intent).length;
  const headingMatches = relevanceTokens(section.headingPath ?? "").filter((term) => blockTerms.has(term)).length;
  return queryMatches * 4 + facetMatches * 12 + headingMatches * 2 + (section.score ?? 0) / 100;
}

function blockIsRelevant(
  block: string,
  heading: string | null,
  section: RetrievalChunk,
  query: string,
  intent: QueryIntent
): boolean {
  const scope = queryScope(intent, query);
  if ((scope === "broad" || scope === "vague" || intent.kind === "definition") && section.tier !== "user") return true;

  const combined = `${section.headingPath ?? ""} ${heading ?? ""} ${block}`;
  const requirements = evidenceRequirementGroups(query, intent);
  const sectionEvidence = [section.tier === "user" ? undefined : section.title, section.headingPath, section.text, section.parentText]
    .filter(Boolean)
    .join(" ");
  if (!matchesEvidenceRequirementGroups(sectionEvidence, requirements)) return false;

  const blockTerms = new Set(relevanceTokens(stripMarkdown(combined)));
  const queryTerms = relevanceTokens(query)
    .filter((term) => !BLOCK_QUERY_NOISE.has(term) && term.length > 1);
  const topicTerms = (intent.topics ?? []).flatMap((topic) => relevanceTokens(topic));
  const primaryTopics = topicTerms.filter((term) => PRIMARY_TOPIC_TERMS.has(term));
  const requestedAwardTopics = primaryTopics.filter((term) => AWARD_TOPIC_TERMS.has(term));
  const sectionAwardTopics = relevanceTokens(`${section.title ?? ""} ${section.headingPath ?? ""}`)
    .filter((term) => AWARD_TOPIC_TERMS.has(term));
  const blockAwardTopics = relevanceTokens(block).filter((term) => AWARD_TOPIC_TERMS.has(term));
  const blockLabelAwardTopics = relevanceTokens(`${section.headingPath ?? ""} ${heading ?? ""}`)
    .filter((term) => AWARD_TOPIC_TERMS.has(term));
  const hasRequestedAward = sectionAwardTopics.some((term) => requestedAwardTopics.includes(term));
  const hasConflictingAward = sectionAwardTopics.some((term) => !requestedAwardTopics.includes(term));
  // Mixed sections such as the shared ISO/NSO tax article are useful, but an
  // ISO-only block must not leak into an NSO answer (or vice versa). A block
  // that explicitly names both sides remains eligible for a comparison.
  if (requestedAwardTopics.length > 0 && hasConflictingAward && !hasRequestedAward) return false;
  if (requestedAwardTopics.length > 0 && blockLabelAwardTopics.some((term) => !requestedAwardTopics.includes(term)) &&
    !blockLabelAwardTopics.some((term) => requestedAwardTopics.includes(term))) return false;
  if (requestedAwardTopics.length > 0 && blockAwardTopics.some((term) => !requestedAwardTopics.includes(term)) &&
    !blockAwardTopics.some((term) => requestedAwardTopics.includes(term))) return false;
  const topicMatch = primaryTopics.length === 0 || primaryTopics.some((term) => blockTerms.has(term));
  const queryMatch = queryTerms.some((term) => blockTerms.has(term));
  const facetMatch = blockFacetMatches(block, intent).length > 0;
  const headingMatch = relevanceTokens(heading ?? "").some((term) => queryTerms.includes(term));

  if (intent.kind === "comparison") {
    const comparisonTopicMatch = topicTerms.length === 0 || topicTerms.some((term) => blockTerms.has(term));
    return comparisonTopicMatch && (queryMatch || facetMatch || headingMatch);
  }
  if (requirements.length > 0) {
    const blockRequirementMatch = requirements.some((group) => group.some((term) => blockTerms.has(term)));
    return topicMatch && (blockRequirementMatch || queryMatch || facetMatch || headingMatch);
  }
  if (topicTerms.length > 0) return topicMatch && (queryMatch || facetMatch || headingMatch);
  return queryMatch || facetMatch;
}

function nearDuplicate(left: string, right: string): boolean {
  const leftTerms = new Set(relevanceTokens(stripMarkdown(left)));
  const rightTerms = new Set(relevanceTokens(stripMarkdown(right)));
  if (leftTerms.size < 12 || rightTerms.size < 12) return false;
  const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  const smaller = Math.min(leftTerms.size, rightTerms.size);
  return smaller > 0 && intersection / smaller >= 0.92;
}

function containedDuplicate(left: string, right: string): boolean {
  const leftTerms = new Set(relevanceTokens(stripMarkdown(left)));
  const rightTerms = new Set(relevanceTokens(stripMarkdown(right)));
  const smaller = leftTerms.size <= rightTerms.size ? leftTerms : rightTerms;
  const larger = smaller === leftTerms ? rightTerms : leftTerms;
  if (smaller.size < 8) return false;
  const intersection = [...smaller].filter((term) => larger.has(term)).length;
  return intersection >= 8 && intersection / smaller.size >= 0.62;
}

function isListBlock(block: string): boolean {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line));
}

function endsWithIntroducer(block: string): boolean {
  return /[:;](?:\\)?["']?$/.test(block.trim());
}

function collectEvidenceBlocks(
  query: string,
  sections: RetrievalChunk[],
  intent: QueryIntent
): EvidenceBlock[] {
  const candidates: EvidenceBlock[] = [];
  const exactKeys = new Set<string>();
  for (const section of sections) {
    const heading = sectionTitle(section);
    const sourceBlocks = splitBlocks(section.parentText ?? section.text);
    const relevant = sourceBlocks.map((text) => blockIsRelevant(text, heading, section, query, intent));
    const selected = new Set<number>(relevant.flatMap((isRelevant, index) => isRelevant ? [index] : []));

    // Markdown lists are often split from the sentence that introduces them,
    // or from the paragraph that completes the last item. Keep those adjacent
    // blocks together so filtering never exposes a dangling "lesser of:" or a
    // partial list item.
    sourceBlocks.forEach((text, index) => {
      if (!selected.has(index)) return;
      if (endsWithIntroducer(text) && isListBlock(sourceBlocks[index + 1] ?? "")) selected.add(index + 1);
      if (isListBlock(text) && index > 0 && endsWithIntroducer(sourceBlocks[index - 1])) selected.add(index - 1);
    });

    for (const [index, sourceText] of sourceBlocks.entries()) {
      if (!selected.has(index)) continue;
      const text = removeLeadingQuestionEcho(sourceText, query);
      const key = plainKey(text);
      if (!key || exactKeys.has(key) || (intent.kind === "definition" && key === plainKey(query))) continue;
      exactKeys.add(key);
      if (candidates.some((existing) => nearDuplicate(existing.text, text))) continue;
      candidates.push({
        text,
        section,
        heading,
        coveredFacets: blockFacetMatches(text, intent),
        relevance: blockRelevance(text, section, query, intent),
      });
    }
  }

  // FAQ answers are useful when they add a missing rule, but the same answer
  // is frequently repeated in the article body. Remove only FAQ blocks that
  // are substantially contained in a non-FAQ block; unique FAQ coverage stays.
  const bodyBlocks = candidates.filter((block) => block.section.sectionKind !== "faq");
  return candidates.filter((block) =>
    block.section.sectionKind !== "faq" || !bodyBlocks.some((body) => containedDuplicate(block.text, body.text))
  );
}

function evidenceTier(words: number): EvidenceTier {
  if (words < 300) return "thin";
  if (words <= 800) return "moderate";
  if (words <= 1800) return "rich";
  return "very-rich";
}

function wordCount(value: string): number {
  return stripMarkdown(value).split(/\s+/).filter(Boolean).length;
}

/** Profiles every already-grounded reviewed section. The optional fourth
 * argument is accepted for older callers but intentionally ignored: the new
 * contract has no editorial section cap. */
export function createEvidenceProfile(
  query: string,
  chunks: RetrievalChunk[],
  intent: QueryIntent,
  legacyMaxSections?: number
): EvidenceProfile {
  void legacyMaxSections;
  const relevantSections = dedupeSections(chunks, intent, query);
  const uniqueBlocks = collectEvidenceBlocks(query, relevantSections, intent);
  const relevantWordCount = uniqueBlocks.reduce((total, block) => total + wordCount(block.text), 0);
  const coveredFacets = (intent.facets ?? []).filter((facet) => uniqueBlocks.some((block) => block.coveredFacets.includes(facet)));
  return {
    relevantSections,
    uniqueBlocks,
    relevantWordCount,
    coveredTopics: [...new Set(intent.topics ?? [])],
    coveredFacets,
    tier: evidenceTier(relevantWordCount),
  };
}

/** Compatibility helper for callers that still inspect the old policy shape.
 * Values are unbounded; generated prose is limited only by the character
 * boundary enforced by `compressMarkdownToCharacterLimit`. */
export function answerLengthPolicy(intent: QueryIntent, query = "", profile?: EvidenceProfile): AnswerLengthPolicy {
  void intent;
  void query;
  void profile;
  return { targetWords: Infinity, maxWords: Infinity, maxHeadings: Infinity };
}

export function isWithinAnswerLengthPolicy(
  bodyMarkdown: string,
  intent: QueryIntent,
  query: string,
  profile?: EvidenceProfile
): boolean {
  void bodyMarkdown;
  void intent;
  void query;
  void profile;
  return true;
}

function openingHeadingForIntent(intent: QueryIntent, query: string): string {
  const facets = new Set(intent.facets ?? []);
  if (facets.has("tax")) return "Tax treatment";
  if (facets.has("scenario")) return "What happens";
  if (facets.has("lifecycle")) return "Lifecycle";
  if (facets.has("explanation")) return "Why it matters";
  if (facets.has("process") || facets.has("mechanics")) return "How it works";
  if (intent.kind === "definition") return "Definition";
  if (queryScope(intent, query) === "broad" || queryScope(intent, query) === "vague") return "Overview";
  return "Overview";
}

export { openingHeadingForIntent };

function markdownHeading(value: string): string | null {
  const match = value.match(/^\s*#{1,6}\s+(.+)$/);
  return match?.[1]?.replace(/[\s:.]+$/, "").trim() || null;
}

function markdownUnits(markdown: string): string[] {
  const blocks = markdown.trim().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const units: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const heading = markdownHeading(blocks[index]);
    if (heading && index + 1 < blocks.length && !markdownHeading(blocks[index + 1])) {
      units.push(`${blocks[index]}\n\n${blocks[index + 1]}`);
      index += 1;
    } else {
      units.push(blocks[index]);
    }
  }
  return units;
}

function splitLongMarkdownUnit(unit: string, target: number): string[] {
  if (unit.length <= target) return [unit];

  const lines = unit.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = lines[0] && markdownHeading(lines[0]) ? lines[0] : null;
  const content = (heading ? lines.slice(1) : lines).join("\n").trim();
  if (!content) return [];

  // Lists are already complete editorial units. Split only between items if
  // an unusually large list reaches the transport boundary; a long individual
  // item is left out rather than cut in the middle of a sentence.
  const contentLines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const isList = contentLines.length > 0 && contentLines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line));
  const pieces = isList
    ? contentLines
    : (content.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? []).map((piece) => piece.trim()).filter(Boolean);
  const output: string[] = [];

  pieces.forEach((piece, index) => {
    if (!piece || piece.length >= target) return;
    const candidate = heading && index === 0 ? `${heading}\n\n${piece}` : piece;
    if (candidate.length <= target) output.push(candidate);
  });
  return output;
}

function compressionScore(unit: string, query: string, intent?: QueryIntent, index = 0): number {
  const terms = new Set(relevanceTokens(stripMarkdown(unit)));
  const queryMatches = relevanceTokens(query).filter((term) => terms.has(term)).length;
  const facetMatches = intent
    ? (intent.facets ?? []).reduce((total, facet) => {
      const facetSet = facetTerms(facet);
      return total + ([...facetSet].some((term) => terms.has(term)) ? 1 : 0);
    }, 0)
    : 0;
  const headingBoost = markdownHeading(unit) ? 80 : 0;
  return (index === 0 ? 200 : 0) + headingBoost + queryMatches * 3 + facetMatches * 12;
}

/**
 * Reduce only by dropping complete Markdown units. This is a last-resort
 * transport safeguard for unusually broad or multi-question requests; normal
 * answers pass through unchanged and are never character-sliced.
 */
export function compressMarkdownToCharacterLimit(
  markdown: string,
  options: {
    query?: string;
    intent?: QueryIntent;
    targetCharacters?: number;
    /** Top-level headings that must retain at least their first content unit. */
    requiredHeadingKeys?: string[];
  } = {}
): string {
  const target = Math.min(
    options.targetCharacters ?? TARGET_GENERATED_BODY_CHARACTERS,
    TARGET_GENERATED_BODY_CHARACTERS
  );
  const normalized = markdown.trim();
  if (normalized.length <= target) return normalized;

  const units = markdownUnits(normalized).flatMap((unit) => splitLongMarkdownUnit(unit, target));
  if (!units.length) return "";
  const scored = units
    .map((unit, index) => ({ unit, index, score: compressionScore(unit, options.query ?? "", options.intent, index) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = new Set<number>();
  const selectedText = new Map<number, string>();

  const key = (value: string): string => value
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const requiredKeys = new Set((options.requiredHeadingKeys ?? []).map(key));
  const requiredIndices = new Set<number>([0]);

  units.forEach((unit, index) => {
    const heading = markdownHeading(unit);
    if (!heading || !requiredKeys.has(key(heading))) return;
    requiredIndices.add(index);
    // A batch part heading can be followed by a subsection heading. Keep the
    // first following content unit too, unless the next unit is another
    // required part heading.
    const next = units[index + 1];
    if (next && !requiredKeys.has(key(markdownHeading(next) ?? ""))) requiredIndices.add(index + 1);
  });

  const scoreByIndex = new Map(scored.map((candidate) => [candidate.index, candidate.score]));

  const renderSelected = (): string => [...selected]
    .sort((left, right) => left - right)
    .map((index) => selectedText.get(index) ?? units[index])
    .join("\n\n");

  const addIfFits = (index: number, replacement = units[index]): boolean => {
    if (selected.has(index)) return true;
    const proposed = [...selectedText.entries(), [index, replacement] as const]
      .sort(([left], [right]) => left - right)
      .map(([, text]) => text)
      .join("\n\n");
    if (proposed.length > target) return false;
    selected.add(index);
    selectedText.set(index, replacement);
    return true;
  };

  const removeLowestValueOptional = (): boolean => {
    const optional = [...selected]
      .filter((index) => !requiredIndices.has(index))
      .sort((left, right) => (scoreByIndex.get(left) ?? 0) - (scoreByIndex.get(right) ?? 0) || right - left);
    const index = optional[0];
    if (index === undefined) return false;
    selected.delete(index);
    selectedText.delete(index);
    return true;
  };

  const firstCompleteFragment = (unit: string): string => {
    const heading = markdownHeading(unit) ? unit.split("\n")[0].trim() : "";
    const content = heading ? unit.slice(unit.indexOf("\n") + 1).trim() : unit.trim();
    if (!content) return heading;
    if (/^(?:[-*]|\d+[.)])\s+/.test(content)) {
      const firstItem = content.split("\n").find(Boolean)?.trim() ?? "";
      return heading ? `${heading}\n\n${firstItem}` : firstItem;
    }
    const sentence = content.match(/[^.!?]+[.!?]+(?:\s|$)/)?.[0]?.trim() ?? "";
    return heading ? `${heading}\n\n${sentence || content}` : sentence || content;
  };

  const addRequired = (index: number): void => {
    if (addIfFits(index)) return;
    // Required headings and the first complete block for each batch part are
    // more important than optional detail. Normally this path is unused; it
    // protects required coverage if a very large request reaches the transport
    // boundary after all optional units have already been selected.
    const fragment = firstCompleteFragment(units[index]);
    while (!addIfFits(index, fragment) && removeLowestValueOptional()) {
      // Keep evicting low-value optional units until the required block fits.
    }
    if (!selected.has(index)) addIfFits(index, fragment);
  };

  // Retain the opening block and explicit batch headings before optional
  // detail. If a pathological request cannot fit all required blocks, the
  // subsequent relevance pass still keeps the highest-value complete units.
  for (const index of [...requiredIndices].sort((left, right) => left - right)) addRequired(index);

  for (const candidate of scored) {
    addIfFits(candidate.index);
  }

  return renderSelected().trim();
}

/** Builds plaintext from the same complete answer shown on screen. */
export function buildQuickShare(bodyMarkdown: string): string {
  return stripMarkdown(bodyMarkdown)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeIncompleteTrailingBlock(blocks: string[]): string[] {
  const cleaned = [...blocks];
  const lastIndex = cleaned.length - 1;
  if (lastIndex < 0) return cleaned;

  const last = cleaned[lastIndex].trim();
  // A source section that ends with a colon or semicolon without the list or
  // sentence it introduces is incomplete. Dropping that final source block is
  // safer than presenting a visibly cut-off answer; earlier complete evidence
  // remains available to the user.
  if (!/[:;](?:\\)?["']?$/.test(last)) return cleaned;
  cleaned.pop();
  if (cleaned.length > 0 && markdownHeading(cleaned[cleaned.length - 1])) cleaned.pop();
  return cleaned;
}

/**
 * Compose an answer from complete reviewed blocks. No word or heading cap is
 * applied. The only reduction is the deterministic character safeguard above.
 */
export function composeWikiAnswer(
  query: string,
  chunks: RetrievalChunk[],
  intent: QueryIntent,
  options: ComposeOptions = {}
): ComposedAnswer | null {
  const profile = options.profile ?? createEvidenceProfile(query, chunks, intent);
  if (profile.uniqueBlocks.length === 0) return null;

  const blocksBySection = new Map<string, EvidenceBlock[]>();
  for (const block of profile.uniqueBlocks) {
    const key = block.section.parentId ?? `${block.section.nodeId ?? "none"}:${sectionTitle(block.section) ?? "section"}`;
    const existing = blocksBySection.get(key) ?? [];
    existing.push(block);
    blocksBySection.set(key, existing);
  }

  const output: string[] = [];
  const openingHeading = openingHeadingForIntent(intent, query);
  if (options.includeOpeningHeading !== false) output.push(`## ${openingHeading}`);

  for (const section of profile.relevantSections) {
    const key = section.parentId ?? `${section.nodeId ?? "none"}:${sectionTitle(section) ?? "section"}`;
    const sectionBlocks = blocksBySection.get(key) ?? [];
    if (sectionBlocks.length === 0) continue;
    const heading = sectionTitle(section);
    if (heading && plainKey(heading) !== plainKey(openingHeading) && !output.some((item) => markdownHeading(item) === heading)) {
      output.push(`## ${heading}`);
    }
    output.push(...sectionBlocks.map((block) => block.text));
  }

  const bodyMarkdown = compressMarkdownToCharacterLimit(
    removeIncompleteTrailingBlock(output).join("\n\n"),
    { query, intent }
  );
  if (!bodyMarkdown || wordCount(bodyMarkdown) === 0) return null;
  return { bodyMarkdown, quickShare: buildQuickShare(bodyMarkdown) };
}
