import type { ArtifactResult, ComparisonData } from "@/lib/llm/types";
import { ComparisonDataSchema, comparisonToMarkdown, comparisonToQuickShare } from "./comparison";
import { normalizeArtifactTitle } from "./title";

const INLINE_CITATION = /【[^】]*(?:nodeId|sourceId)[^】]*】/gi;
const BARE_CITATION = /\b(?:nodeId|sourceId)\s*(?:=|:)\s*(?:"[^"]*"|'[^']*'|[A-Za-z0-9._-]+)/gi;
const BRACKETED_CITATION = /[\[(]\s*["']?(?:node\s*id|source\s*id|node|source|id)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?\s*[\])]/gi;
const NAMED_CITATION = /\b(?:node|source)\s*(?:id|identifier)?\s*[:=]\s*["']?(?:\d+(?:\.\d+)+|u-[a-z0-9_-]+|source-[a-z0-9_-]+)["']?/gi;
const PROHIBITED_SOURCE_NAMES = /\b(?:NASPP|MyStockOptions)\b/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeKnownReferenceWrappers(text: string, knownIdentifiers: string[]): string {
  if (knownIdentifiers.length === 0) return text;
  const ids = knownIdentifiers.map(escapeRegExp).join("|");
  const wrapper = new RegExp(`(?:\\[|\\()(?:node\\s*id|source\\s*id|node|source|id)?\\s*[:=]?\\s*(?:${ids})\\s*(?:\\]|\\))`, "gi");
  return text.replace(wrapper, "");
}

function removeUnmatchedMarkdown(text: string): string {
  const boldMarkers = text.match(/\*\*/g)?.length ?? 0;
  return boldMarkers % 2 === 0 ? text : text.replace(/\*\*/g, "");
}

function cleanInlineText(text: string, knownIdentifiers: string[] = []): string {
  const withoutKnownWrappers = removeKnownReferenceWrappers(text, knownIdentifiers);
  return withoutKnownWrappers
    .replace(INLINE_CITATION, "")
    .replace(BRACKETED_CITATION, "")
    .replace(BARE_CITATION, "")
    .replace(NAMED_CITATION, "")
    .replace(/\b(?:according to|per|from)\s+(?:NASPP|MyStockOptions)\s*[:,]?\s*/gi, "")
    .replace(/\baccording to the knowledge base\s*[:,]?\s*/gi, "")
    .replace(/(?:#{1,6}\s*)?\breference guide\s*[:,]?\s*/gi, "")
    .replace(/\b(?:NASPP|MyStockOptions)(?:\s+and\s+(?:NASPP|MyStockOptions))?\s+(?:explain|explains|state|states|say|says)\s+(?:that\s+)?/gi, "")
    .replace(/\b(?:NASPP|MyStockOptions)\s+(?:explains?|states?|says?)\s+(?:that\s+)?/gi, "")
    .replace(PROHIBITED_SOURCE_NAMES, "the available guidance")
    .replace(/\b(?:node|source)\s+(?:id\s*)?(?:\d+(?:\.\d+)+|u-[a-z0-9_-]+|source-[a-z0-9_-]+)\b/gi, "")
    .replace(/\b(?:id|identifier)\s*[:=]\s*(?:\d+(?:\.\d+)+|u-[a-z0-9_-]+|source-[a-z0-9_-]+)\b/gi, "")
    .replace(/[\u2014\u2013]/g, " - ")
    .split("\n")
    .map((line) => removeUnmatchedMarkdown(line)
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\[\s*\]|\(\s*\)/g, "")
      .replace(/\s+(?:and|or|plus)(?=\s*[.?!])/gi, "")
      .replace(/[ \t]+([,.;!?])/g, "$1")
      .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
      .replace(/[,;](?=\.)/g, "")
      .replace(/:\./g, ":")
      .trim())
    .filter((line) => !/^#{1,6}\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeComparison(comparison: ComparisonData, knownIdentifiers: string[] = []): ComparisonData {
  return {
    title: normalizeGeneratedText(comparison.title, knownIdentifiers),
    subtitle: normalizeGeneratedText(comparison.subtitle, knownIdentifiers),
    columns: comparison.columns.map((column) => normalizeGeneratedText(column, knownIdentifiers)),
    rows: comparison.rows.map((row) => ({
      feature: normalizeGeneratedText(row.feature, knownIdentifiers),
      values: row.values.map((value) => normalizeGeneratedText(value, knownIdentifiers)),
    })),
    takeaway: normalizeGeneratedText(comparison.takeaway, knownIdentifiers),
  };
}

function cleanHeading(line: string): string | null {
  const markdownHeading = line.match(/^(\s*)(#{1,6})\s+(.*)$/);
  if (markdownHeading) {
    const body = markdownHeading[3].replace(/[\s:.]+$/, "").trim();
    return body ? `${markdownHeading[1]}${markdownHeading[2]} ${body}` : "";
  }

  const boldHeading = line.match(/^(\s*)\*\*([^*\n]+)\*\*\s*[:.]*\s*$/);
  if (boldHeading) {
    const body = boldHeading[2].replace(/[\s:.]+$/, "").trim();
    return body ? `${boldHeading[1]}## ${body}` : "";
  }

  return null;
}

function comparisonKey(value: string): string {
  return value
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/\*\*|__/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Provider output sometimes starts by repeating its own title or the user
 * question. Remove only an exact leading block, leaving legitimate prose
 * that happens to mention the same topic later intact. */
function removeLeadingEcho(text: string, query: string, title: string): string {
  const targets = new Set([comparisonKey(query), comparisonKey(title)].filter(Boolean));
  if (targets.size === 0) return text;

  const blocks = text.split(/\n{2,}/);
  const first = blocks[0] ?? "";
  return targets.has(comparisonKey(first)) ? blocks.slice(1).join("\n\n").trim() : text;
}

/**
 * Final, provider-independent cleanup for generated artifacts. Structured
 * citations are deliberately not touched: they power internal links and Brain
 * backlinks while this function cleans only user-visible generated text.
 */
export function normalizeGeneratedText(text: string, knownIdentifiers: string[] = []): string {
  const cleaned = cleanInlineText(text, knownIdentifiers);
  return cleaned
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const heading = cleanHeading(line);
      if (heading !== null) return heading;
      return line.replace(/:\.(?=\s|$)/g, ":");
    })
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function normalizeGeneratedArtifact(
  artifact: ArtifactResult,
  query?: string,
  trustedIdentifiers: string[] = []
): ArtifactResult {
  const knownIdentifiers = [
    ...new Set([
      ...artifact.citations.flatMap((citation) => [citation.nodeId, citation.sourceId].filter((id): id is string => Boolean(id))),
      ...trustedIdentifiers,
    ]),
  ];
  const comparison = artifact.comparison
    ? ComparisonDataSchema.parse(normalizeComparison(artifact.comparison, knownIdentifiers))
    : undefined;
  const title = query
    ? normalizeArtifactTitle(normalizeGeneratedText(artifact.title, knownIdentifiers), query)
    : normalizeGeneratedText(artifact.title, knownIdentifiers);
  const body = comparison
    ? normalizeGeneratedText(comparisonToMarkdown(comparison))
    : removeLeadingEcho(normalizeGeneratedText(artifact.bodyMarkdown), query ?? "", title);
  const quickShare = comparison
    ? normalizeGeneratedText(comparisonToQuickShare(comparison))
    : removeLeadingEcho(normalizeGeneratedText(artifact.quickShare), query ?? "", title);
  return {
    ...artifact,
    title,
    bodyMarkdown: body,
    quickShare,
    citations: artifact.citations,
    comparison,
  };
}

/** Final safety check before an artifact is persisted or returned. A failed
 * check is handled by the route with the already-selected grounding set, so a
 * provider cannot turn malformed or empty JSON into a successful blank card. */
export function isUsableGeneratedArtifact(artifact: ArtifactResult): boolean {
  const fields = [artifact.title, artifact.bodyMarkdown, artifact.quickShare];
  const body = artifact.bodyMarkdown.trim();
  if (!body) return false;
  if (fields.some((field) => /[\u2014\u2013]|:\./.test(field))) return false;
  if (fields.some((field) => /\b(?:NASPP|MyStockOptions)\b/i.test(field))) return false;
  if (fields.some((field) => /\breference guide\b|\baccording to the knowledge base\b/i.test(field))) return false;
  if (fields.some((field) => /[【】]|\b(?:nodeId|sourceId)\b/i.test(field))) return false;
  if (fields.some((field) => /\b(?:node|source)\s*(?:id|identifier)?\s*(?::|=)?\s*(?:\d+(?:\.\d+)+|u-[a-z0-9_-]+|source-[a-z0-9_-]+)/i.test(field))) return false;
  if (fields.some((field) => /<\/?[A-Za-z][^>]*>/.test(field))) return false;
  if ((body.match(/\*\*/g)?.length ?? 0) % 2 !== 0) return false;
  if (artifact.comparison) {
    try { ComparisonDataSchema.parse(artifact.comparison); } catch { return false; }
  }
  return true;
}
