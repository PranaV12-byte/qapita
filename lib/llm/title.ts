import { resolveDefinitionTopic } from "./query-intent";

const MAX_ARTIFACT_TITLE_LENGTH = 160;

function stripTerminalPunctuation(value: string): string {
  return value.replace(/[?!.]+$/g, "").trim();
}

/** Keep transport-safe titles complete at a word boundary. The full question is
 * rendered separately in the UI and is never shortened. */
export function shortenTitle(value: string, maxLength = MAX_ARTIFACT_TITLE_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 24 ? cut.slice(0, boundary) : cut).trim()}…`;
}

function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A generated title is useful when it summarizes the answer, but it should
 * not repeat the original question with only casing or punctuation changed. */
export function isRedundantArtifactTitle(title: string, question: string): boolean {
  const titleKey = comparisonKey(title);
  const questionKey = comparisonKey(question);
  return Boolean(titleKey && questionKey && titleKey === questionKey);
}

export function titleFromQuery(query: string): string {
  const cleaned = stripTerminalPunctuation(query.replace(/\s+/g, " "));
  const comparison = cleaned.match(/^what\s+is\s+the\s+difference\s+between\s+(.+?)\s+and\s+(.+)$/i);
  if (comparison) return shortenTitle(`${comparison[1].trim()} vs. ${comparison[2].trim()}`);

  // Keep the document subject short when the question contains a second
  // request for detail. The complete question is carried separately in the
  // result, PDF, and email, so repeating it here makes the answer look broken.
  const howItWorks = cleaned.match(/^how\s+does\s+(.+?)\s+work\b/i);
  if (howItWorks) return shortenTitle(`How ${howItWorks[1].trim()} works`);

  const taxQuestion = cleaned.match(/^how\s+(?:is|are)\s+(.+?)\s+taxed\b/i);
  if (taxQuestion) return shortenTitle(`Tax treatment of ${taxQuestion[1].trim()}`);

  const definition = cleaned.match(/^(?:what|who)\s+(?:is|are|was|were)\s+(.+)$/i);
  if (definition) {
    const topic = resolveDefinitionTopic(query);
    return shortenTitle(topic?.title ?? cleaned);
  }

  const firstQuestion = cleaned.split(/[?!]/, 1)[0].trim();
  return shortenTitle(firstQuestion || "Your equity compensation question");
}

export function normalizeArtifactTitle(candidate: string | undefined, query: string): string {
  const definitionTopic = resolveDefinitionTopic(query);
  if (definitionTopic) return definitionTopic.title;
  const cleaned = stripTerminalPunctuation(
    (candidate ?? "")
      .replace(/^(?:reference|email\s+draft|comparison)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
  );
  return shortenTitle(cleaned || titleFromQuery(query));
}
