import type { ArtifactResult, ComparisonData } from "@/lib/llm/types";
import { ComparisonDataSchema, comparisonToMarkdown, comparisonToQuickShare } from "./comparison";
import { normalizeArtifactTitle } from "./title";

const INLINE_CITATION = /【[^】]*(?:nodeId|sourceId)[^】]*】/gi;
const BARE_CITATION = /\b(?:nodeId|sourceId)\s*(?:=|:)\s*(?:"[^"]*"|'[^']*'|[A-Za-z0-9._-]+)/gi;
const PROHIBITED_SOURCE_NAMES = /\b(?:NASPP|MyStockOptions)\b/gi;

function cleanInlineText(text: string): string {
  return text
    .replace(INLINE_CITATION, "")
    .replace(BARE_CITATION, "")
    .replace(PROHIBITED_SOURCE_NAMES, "the knowledge base")
    .replace(/\bthe knowledge base(?:\s+the knowledge base)+\b/gi, "the knowledge base")
    .replace(/[\u2014\u2013]/g, " - ")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([,.;!?])/g, "$1").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeComparison(comparison: ComparisonData): ComparisonData {
  return {
    title: normalizeGeneratedText(comparison.title),
    subtitle: normalizeGeneratedText(comparison.subtitle),
    columns: comparison.columns.map((column) => normalizeGeneratedText(column)),
    rows: comparison.rows.map((row) => ({
      feature: normalizeGeneratedText(row.feature),
      values: row.values.map((value) => normalizeGeneratedText(value)),
    })),
    takeaway: normalizeGeneratedText(comparison.takeaway),
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

/**
 * Final, provider-independent cleanup for generated artifacts. Structured
 * citations are deliberately not touched: they power internal links and Brain
 * backlinks while this function cleans only user-visible generated text.
 */
export function normalizeGeneratedText(text: string): string {
  const cleaned = cleanInlineText(text);
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

export function normalizeGeneratedArtifact(artifact: ArtifactResult, query?: string): ArtifactResult {
  const comparison = artifact.comparison
    ? ComparisonDataSchema.parse(normalizeComparison(artifact.comparison))
    : undefined;
  return {
    ...artifact,
    title: query ? normalizeArtifactTitle(artifact.title, query) : normalizeGeneratedText(artifact.title),
    bodyMarkdown: comparison
      ? normalizeGeneratedText(comparisonToMarkdown(comparison))
      : normalizeGeneratedText(artifact.bodyMarkdown),
    quickShare: comparison
      ? normalizeGeneratedText(comparisonToQuickShare(comparison))
      : normalizeGeneratedText(artifact.quickShare),
    citations: artifact.citations,
    comparison,
  };
}
