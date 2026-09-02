import type { RetrievalChunk } from "../rag/types";
import { relevanceTokens } from "../rag/relevance";
import type { QueryFacet, QueryIntent } from "./query-intent";

export type ComposedAnswer = {
  bodyMarkdown: string;
  quickShare: string;
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

function plainKey(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes only the Markdown subset that the answer surfaces support. */
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
    .map((line) => line.trim())
    .filter((line) => !/^<\/?[A-Za-z][^>]*>$/.test(line));

  const cleaned = lines
    .map((line) => line.replace(/<\/?[A-Za-z][^>]*>/g, "").trim())
    .filter(Boolean)
    .join("\n");

  if (!cleaned) return "";
  const boldMarkers = cleaned.match(/\*\*/g)?.length ?? 0;
  if (boldMarkers % 2 !== 0) return cleaned.replace(/\*\*/g, "");
  return cleaned;
}

function splitBlocks(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let currentList: "unordered" | "ordered" | null = null;

  const flush = () => {
    const block = cleanBlock(current.join("\n"));
    if (block) blocks.push(block);
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
  return blocks;
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
  const heading = `${chunk.title ?? ""} ${chunk.headingPath ?? ""}`.toLowerCase();
  const evidenceTerms = new Set(relevanceTokens([
    chunk.title,
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
  return summaryBoost + facetMatches * 12 + queryMatches * 3 + faqBoost + (chunk.score ?? 0) / 100;
}

function sectionPosition(chunk: RetrievalChunk): number {
  const parentId = chunk.parentId ?? "";
  if (parentId.endsWith("#summary")) return -1;
  const faq = parentId.match(/#faq-(\d+)$/);
  if (faq) return 10_000 + Number(faq[1]);
  const section = parentId.match(/#(\d+)$/);
  return section ? Number(section[1]) : 0;
}

function logicalSectionOrder(left: RetrievalChunk, right: RetrievalChunk): number {
  if (left.nodeId !== right.nodeId) return 0;
  return sectionPosition(left) - sectionPosition(right);
}

function dedupeSections(chunks: RetrievalChunk[], intent: QueryIntent, query: string): RetrievalChunk[] {
  const seen = new Set<string>();
  return [...chunks]
    .filter((chunk) => chunk.tier !== "scrape")
    .sort((left, right) => sectionScore(right, intent, query) - sectionScore(left, intent, query))
    .filter((chunk) => {
      const key = chunk.parentId ?? `${chunk.nodeId ?? "none"}:${plainKey(chunk.text).slice(0, 120)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sectionLimit(intent: QueryIntent): number {
  if (intent.kind === "definition") return 3;
  if ((intent.facets ?? []).length >= 2) return 4;
  if ((intent.facets ?? []).length > 0) return 4;
  return 3;
}

type AnswerLengthPolicy = {
  targetWords: number;
  maxWords: number;
  maxHeadings: number;
};

/**
 * The deterministic provider has no model to decide how much context is
 * enough. These bounds keep a real answer useful on screen while ensuring a
 * narrow question does not turn into a copy of an entire article. The target
 * is a selection preference, not a padding requirement.
 */
export function answerLengthPolicy(intent: QueryIntent): AnswerLengthPolicy {
  if (intent.kind === "definition") {
    return { targetWords: 160, maxWords: 220, maxHeadings: 3 };
  }

  const facetCount = intent.facets?.length ?? 0;
  if (facetCount >= 2) {
    return { targetWords: 300, maxWords: 400, maxHeadings: 3 };
  }
  if (facetCount > 0) {
    return { targetWords: 240, maxWords: 350, maxHeadings: 3 };
  }
  return { targetWords: 180, maxWords: 250, maxHeadings: 3 };
}

function isQuestionEcho(block: string, query: string, intent: QueryIntent): boolean {
  const key = plainKey(block);
  if (!key) return true;
  if (key === plainKey(query)) return true;
  return intent.kind === "definition" && key === plainKey(intent.title);
}

function wordCount(value: string): number {
  return stripMarkdown(value).split(/\s+/).filter(Boolean).length;
}

/**
 * Builds readable answer prose from complete reviewed sections. The composer is
 * intentionally extractive: it can improve structure and depth without making
 * an unsupported claim when Netlify is running without an external model.
 */
export function composeWikiAnswer(
  query: string,
  chunks: RetrievalChunk[],
  intent: QueryIntent
): ComposedAnswer | null {
  const policy = answerLengthPolicy(intent);
  const sections = dedupeSections(chunks, intent, query)
    .slice(0, sectionLimit(intent))
    .sort(logicalSectionOrder);
  const output: string[] = [];
  const seenBlocks = new Set<string>();
  let words = 0;
  let headings = 0;

  for (const section of sections) {
    const source = section.parentText ?? section.text;
    const blocks = splitBlocks(source);
    if (blocks.length === 0) continue;

    const selectedBlocks: string[] = [];
    for (const block of blocks) {
      if (isQuestionEcho(block, query, intent)) continue;
      const key = plainKey(block);
      if (!key || seenBlocks.has(key)) continue;
      const nextWords = wordCount(block);
      if (!nextWords || words + nextWords > policy.maxWords) continue;
      seenBlocks.add(key);
      selectedBlocks.push(block);
      words += nextWords;
      if (words >= policy.targetWords) break;
    }
    if (selectedBlocks.length === 0) continue;

    const heading = sectionTitle(section);
    const headingWords = heading ? wordCount(heading) : 0;
    if (heading && output.length > 0 && headings < policy.maxHeadings && words + headingWords <= policy.maxWords) {
      output.push(`## ${heading}`);
      headings += 1;
      words += headingWords;
    }
    output.push(...selectedBlocks);

    // Once the answer has reached its target, do not add another section just
    // because one happened to rank next. A single section can still be the
    // complete answer when it is the only reliable evidence available.
    if (words >= policy.targetWords) break;
  }

  const bodyMarkdown = output.join("\n\n").trim();
  if (!bodyMarkdown || wordCount(bodyMarkdown) < 12) return null;
  const quickShare = stripMarkdown(bodyMarkdown).replace(/\s+/g, " ").trim();
  return { bodyMarkdown, quickShare };
}
