import { z } from "zod";
import type { ComparisonData, ComparisonRow } from "./types";
import type { ArtifactFormat } from "./types";
import type { RetrievalChunk } from "../rag/types";
import { relevanceTokens } from "../rag/relevance";
import { getNode } from "../content/tree";
import { isComparisonQuery } from "./grounding";
import { shortenTitle } from "./title";

// This contract is shared by the provider, on-screen comparison card, PDF, and
// email. Keeping its limits here stops one surface from accepting a table that
// another surface cannot render safely.
const comparisonRowSchema = z.object({
  feature: z.string().trim().min(1).max(100),
  values: z.array(z.string().trim().min(1).max(420)).min(2).max(4),
}).strict();

export const ComparisonDataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().min(1).max(260),
  columns: z.array(z.string().trim().min(1).max(100)).min(2).max(4),
  rows: z.array(comparisonRowSchema).min(1).max(12),
  takeaway: z.string().trim().min(1).max(600),
}).strict().superRefine((data, context) => {
  const seenColumns = new Set<string>();
  data.columns.forEach((column, index) => {
    const key = column.toLowerCase();
    if (seenColumns.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columns", index],
        message: "Comparison topic columns must be unique.",
      });
    }
    seenColumns.add(key);
  });
  for (const [index, row] of data.rows.entries()) {
    if (row.values.length !== data.columns.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", index, "values"],
        message: "Each comparison row must contain one value per topic column.",
      });
    }
  }
});

export type ComparisonValidationResult =
  | { ok: true; data: ComparisonData }
  | { ok: false; message: string };

export function validateComparisonData(input: unknown): ComparisonValidationResult {
  const parsed = ComparisonDataSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid comparison data." };
}

export function isValidComparisonData(input: unknown): input is ComparisonData {
  return validateComparisonData(input).ok;
}

/** A PDF question may request a structured table even when the visible result
 * remains the ordinary answer flow. The comparison format always requests it. */
export function wantsStructuredComparison(query: string, format?: ArtifactFormat): boolean {
  return format === "comparison" || (format === "pdf" && isComparisonQuery(query));
}

export function comparisonToMarkdown(data: ComparisonData): string {
  const rows = data.rows.map((row) =>
    `- **${row.feature}:** ${data.columns.map((column, index) => `${column}: ${row.values[index]}`).join("; ")}`
  );
  return [
    `## ${data.title}`,
    data.subtitle,
    "",
    "## Comparison",
    ...rows,
    "",
    "## Bottom Line",
    data.takeaway,
  ].join("\n");
}

export function comparisonToQuickShare(data: ComparisonData): string {
  return [
    data.title,
    data.subtitle,
    ...data.rows.map((row) =>
      `${row.feature}: ${data.columns.map((column, index) => `${column}: ${row.values[index]}`).join("; ")}`
    ),
    `Bottom Line: ${data.takeaway}`,
  ].join("\n\n");
}

type ComparisonSideResult = {
  sides: string[];
  tooMany: boolean;
};

const COMPARISON_STOP_WORDS = new Set([
  "tax", "taxation", "treatment", "eligibility", "vesting", "exercise", "mechanics",
  "differences", "difference", "key", "important", "main", "points", "terms", "between",
  "company", "employee", "employees", "share", "shares", "award", "awards", "option", "options",
]);

const COMPARISON_TOPIC_TERMS = new Set([
  "iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom", "tender", "liquidity",
]);

function cleanTopicText(value: string): string {
  return value
    .replace(/[?!.:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicList(value: string): string[] {
  return value
    .replace(/\b(?:and|&|vs\.?|versus)\b/gi, ",")
    .split(",")
    .map(cleanTopicText)
    .filter(Boolean);
}

function stripComparisonQualifier(value: string): string {
  // Semicolon clauses such as “focus on tax” qualify the comparison; they do
  // not name a third topic. Keep the parser from turning that qualifier into
  // a column label while leaving commas available for the actual topic list.
  return value.replace(/\s*;\s*(?:focus|focusing|consider|including|compare)\b.*$/i, "").trim();
}

/** Parse only explicit comparison sides. This prevents a related phrase such
 * as "tax treatment and eligibility" from becoming an invented column. */
export function extractComparisonSides(query: string): ComparisonSideResult {
  // A user may add a second sentence after the comparison request. Keep the
  // explicit topic list and discard that follow-up so it cannot become part of
  // the last column label.
  const cleaned = query.split("?", 1)[0].replace(/\s+/g, " ").trim().replace(/[!.:;]+$/g, "");
  const between = cleaned.match(/\bbetween\s+(.+)$/i);
  if (between) {
    const subject = stripComparisonQualifier(between[1]).split(/\b(?:for|on|with|regarding|in terms of|when)\b/i)[0];
    const sides = topicList(subject);
    return { sides, tooMany: sides.length > 4 };
  }

  const explicitVs = cleaned.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+\b(?:for|on|with|regarding|in terms of)\b|$)/i);
  if (explicitVs) {
    const sides = [cleanTopicText(stripComparisonQualifier(explicitVs[1]).replace(/^(?:compare|what\s+is\s+the\s+difference\s+between)\s+/i, "")), cleanTopicText(stripComparisonQualifier(explicitVs[2]))].filter(Boolean);
    return { sides, tooMany: sides.length > 4 };
  }

  const comparePair = cleaned.match(/\bcompare(?:\s+the)?\s+(.+?)\s+(?:to|with|against)\s+(.+)$/i);
  if (comparePair) {
    const sides = [cleanTopicText(stripComparisonQualifier(comparePair[1])), cleanTopicText(stripComparisonQualifier(comparePair[2]))].filter(Boolean);
    return { sides, tooMany: sides.length > 4 };
  }

  const compareVerb = cleaned.match(/\b(.+?)\s+compares?\s+(?:to|with|against)\s+(.+)$/i);
  if (compareVerb) {
    const sides = [cleanTopicText(stripComparisonQualifier(compareVerb[1]).replace(/^how\s+(?:do|does)\s+/i, "")), cleanTopicText(stripComparisonQualifier(compareVerb[2]))].filter(Boolean);
    return { sides, tooMany: sides.length > 4 };
  }

  const compareQuestion = cleaned.match(/^how\s+(?:do|does)\s+(.+?)\s+compare$/i);
  if (compareQuestion) {
    const sides = topicList(compareQuestion[1]);
    return { sides, tooMany: sides.length > 4 };
  }

  const afterCompare = cleaned.match(/\bcompare(?:\s+the)?\s+(.+)$/i);
  if (afterCompare) {
    const subject = stripComparisonQualifier(afterCompare[1]).split(/\b(?:for|on|with|regarding|in terms of|when)\b/i)[0];
    const sides = topicList(subject);
    return { sides, tooMany: sides.length > 4 };
  }

  return { sides: [], tooMany: false };
}

function displayLabel(chunk: RetrievalChunk): string {
  const node = chunk.nodeId ? getNode(chunk.nodeId) : undefined;
  if (node) return node.title;
  if (chunk.tier === "user") return chunk.headingPath || "Your uploaded material";
  return chunk.title || chunk.headingPath || "Relevant guidance";
}

function evidenceText(chunk: RetrievalChunk): string {
  return [displayLabel(chunk), chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ");
}

function candidateScore(side: string, chunk: RetrievalChunk): number {
  const sideTerms = relevanceTokens(side).filter((term) => !COMPARISON_STOP_WORDS.has(term));
  if (!sideTerms.length) return 0;
  const labelTerms = new Set(relevanceTokens(displayLabel(chunk) + " " + (chunk.headingPath ?? "")));
  const contentTerms = new Set(relevanceTokens([chunk.headingPath, chunk.text, chunk.parentText].filter(Boolean).join(" ")));
  const allTerms = new Set(relevanceTokens(evidenceText(chunk)));
  const labelMatches = sideTerms.filter((term) => labelTerms.has(term)).length;
  const contentMatches = sideTerms.filter((term) => contentTerms.has(term)).length;
  const allMatches = sideTerms.filter((term) => allTerms.has(term)).length;
  const exact = cleanTopicText(side).toLowerCase();
  const exactMatch = exact.length > 2 && displayLabel(chunk).toLowerCase().includes(exact) ? 20 : 0;
  // A label alone is not enough when the section body never mentions the
  // requested topic. This blocks generic retrieval overlap from turning an
  // unrelated section into a comparison column.
  if (contentMatches === 0) return 0;
  const label = `${displayLabel(chunk)} ${chunk.headingPath ?? ""}`.toLowerCase();
  const sideAffinity = /cash[-\s]?settled|cash\s+(?:awards?|settlements?)/i.test(side)
    ? (/\b(?:sar|phantom|cash[-\s]?settled|liability)\b/i.test(label) ? 36 :
      /\b(?:acquisition|cash acquisition|job & life events)\b/i.test(label) ? -24 : 0)
    : /\bstock\s+options?\b|\boptions?\b/i.test(side)
      ? (/\b(?:option|iso|nso)\b/i.test(label) ? 30 :
        /\b(?:rsu|rsa|sar|phantom)\b/i.test(label) ? -24 : 0)
      : /\brsus?\b/i.test(side)
        ? (/\b(?:rsu|rsa)\b/i.test(label) ? 30 :
          /\b(?:sar|phantom|option|iso|nso)\b/i.test(label) ? -18 : 0)
        : 0;
  return sideAffinity + exactMatch + labelMatches * 12 + contentMatches * 8 + allMatches * 2;
}

function completeSentences(text: string, count: number): string[] {
  const normalized = text
    .replace(/\r?\n+/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const matches = normalized.match(/[^.!?]*[.!?]+(?:\s|$)/g) ?? [];
  return matches.map((item) => item.trim()).filter((item) => item.length >= 24).slice(0, count);
}

function sideEvidenceSentences(chunk: RetrievalChunk, side: string): string[] {
  const candidates = completeSentences(chunk.parentText ?? chunk.text, 6);
  const sideTerms = relevanceTokens(side).filter((term) => !COMPARISON_STOP_WORDS.has(term));
  const focused = candidates.filter((sentence) => {
    const sentenceTerms = new Set(relevanceTokens(sentence));
    return sideTerms.some((term) => sentenceTerms.has(term));
  });
  return (focused.length > 0 ? focused : candidates).slice(0, 2);
}

function conciseEvidence(chunk: RetrievalChunk, side: string): string | null {
  const candidates = sideEvidenceSentences(chunk, side);
  const value = candidates.join(" ").trim();
  if (!value) return null;
  if (value.length <= 420) return value;
  const first = candidates[0];
  return first && first.length <= 420 ? first : null;
}

function columnLabel(side: string, chunk: RetrievalChunk): string {
  const label = displayLabel(chunk);
  if (/cash[-\s]?settled|cash\s+(?:awards?|settlements?)/i.test(side)) return cleanTopicText(side);
  if (/\bstock\s+options?\b|\boptions?\b/i.test(side)) {
    return /\b(?:option|iso|nso)\b/i.test(label) ? label : cleanTopicText(side);
  }
  const requestedTerms = relevanceTokens(side).filter((term) => COMPARISON_TOPIC_TERMS.has(term));
  const labelTopicTerms = relevanceTokens(label).filter((term) => COMPARISON_TOPIC_TERMS.has(term));
  // Use the reviewed taxonomy label when it represents one topic. If the
  // article bundles several award types (for example, RSUs and RSAs), use the
  // explicit side the user asked for so the table does not claim one bundled
  // article is a single side of the comparison.
  if (requestedTerms.length === 0 || labelTopicTerms.every((term) => requestedTerms.includes(term))) return label;
  return cleanTopicText(side);
}

/** Build the deterministic fallback comparison from only named, grounded
 * topics. The provider and Mock paths use the same contract and the same
 * rendering helpers, so a timeout cannot change the shape of the answer. */
export function buildGroundedComparison(query: string, chunks: RetrievalChunk[]): ComparisonData | null {
  const parsed = extractComparisonSides(query);
  if (parsed.tooMany || parsed.sides.length < 2 || parsed.sides.length > 4) return null;

  const matches = parsed.sides.map((side) => {
    let bestChunk: RetrievalChunk | null = null;
    let bestScore = 0;
    chunks.forEach((chunk) => {
      const score = candidateScore(side, chunk);
      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    });
    if (!bestChunk) return null;
    return { side, chunk: bestChunk, evidence: conciseEvidence(bestChunk, side) };
  });

  if (matches.some((match) => !match || !match.evidence)) return null;
  const resolved = matches as Array<{ side: string; chunk: RetrievalChunk; evidence: string }>;
  const preferredColumns = resolved.map(({ side, chunk }) => columnLabel(side, chunk));
  const columns = preferredColumns.map((column, index) => {
    const repeated = preferredColumns.some((other, otherIndex) => otherIndex < index && other.toLowerCase() === column.toLowerCase());
    return repeated ? cleanTopicText(resolved[index].side) : column;
  });
  if (new Set(columns.map((column) => column.toLowerCase())).size !== columns.length) return null;

  const rows: ComparisonRow[] = [{
    feature: "Key guidance",
    values: resolved.map(({ evidence }) => evidence),
  }];
  const secondSentences = resolved.map(({ chunk, side }) => sideEvidenceSentences(chunk, side)[1]);
  if (secondSentences.every(Boolean)) {
    rows.push({ feature: "Additional mechanics", values: secondSentences as string[] });
  }

  return {
    title: shortenTitle(`${columns.join(" vs. ")}: Side-by-side comparison`),
    subtitle: "Side-by-side guidance on the distinctions most relevant to this question.",
    columns,
    rows,
    takeaway: `The available guidance compares ${columns.join(" and ")} on the points shown above. Apply the conditions in each column to the specific plan and facts.`,
  };
}
