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

export function titleFromQuery(query: string): string {
  const cleaned = stripTerminalPunctuation(query.replace(/\s+/g, " "));
  const comparison = cleaned.match(/^what\s+is\s+the\s+difference\s+between\s+(.+?)\s+and\s+(.+)$/i);
  if (comparison) return shortenTitle(`${comparison[1].trim()} vs. ${comparison[2].trim()}`);

  const howItWorks = cleaned.match(/^how\s+does\s+(.+?)\s+work(.*)$/i);
  if (howItWorks) return shortenTitle(`How ${howItWorks[1].trim()} works${howItWorks[2]}`);

  const definition = cleaned.match(/^(?:what|who)\s+(?:is|are|was|were)\s+(.+)$/i);
  if (definition) return shortenTitle(definition[1].trim());

  return shortenTitle(cleaned || "Your equity compensation question");
}

export function normalizeArtifactTitle(candidate: string | undefined, query: string): string {
  const cleaned = stripTerminalPunctuation(
    (candidate ?? "")
      .replace(/^(?:reference|email\s+draft|comparison)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
  );
  return shortenTitle(cleaned || titleFromQuery(query));
}
