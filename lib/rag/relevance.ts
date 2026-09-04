import type { RetrievalChunk } from "./types";

const STOP_WORDS = new Set([
  "a", "about", "after", "all", "also", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "but", "by",
  "can", "could", "describe", "did", "do", "does", "explain", "for", "from", "get", "give", "go",
  "had", "has", "have", "how", "i", "if", "in", "into", "is", "it", "its",
  "know", "me", "more", "my", "of", "on", "or", "our", "should", "so", "some",
  "than", "that", "the", "their", "them", "then", "there", "these", "they",
  "this", "through", "to", "up", "us", "was", "we", "were", "what", "when",
  "tell", "understand", "walk", "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

const NORMALIZED_TERMS: Array<[RegExp, string]> = [
  [/^(tax|taxes|taxed|taxable|taxation)$/i, "tax"],
  [/^(vest|vests|vested|vesting|unvested)$/i, "vest"],
  [/^(exercise|exercises|exercised|exercising)$/i, "exercise"],
  [/^(withhold|withholds|withheld|withholding)$/i, "withhold"],
  [/^(terminate|terminates|terminated|terminating|termination)$/i, "termination"],
  [/^(leave|leaves|leaving|left)$/i, "termination"],
  [/^(sell|sells|selling|sold|sale|sales)$/i, "sale"],
  [/^(option|options)$/i, "option"],
  [/^(share|shares)$/i, "share"],
  [/^(employee|employees)$/i, "employee"],
  [/^(award|awards)$/i, "award"],
  [/^(grant|grants|granted|granting)$/i, "grant"],
  [/^(acquire|acquires|acquired|acquiring|acquisition)$/i, "acquisition"],
  [/^(integration|integrations|integrate|integrated|integrating)$/i, "integration"],
  [/^(iso|isos)$/i, "iso"],
  [/^(nso|nsos|nqso|nqsos)$/i, "nso"],
  [/^(rsu|rsus)$/i, "rsu"],
  [/^(rsa|rsas)$/i, "rsa"],
  [/^(espp|espps)$/i, "espp"],
  [/^(psu|psus)$/i, "psu"],
];

const HIGH_SIGNAL_TERMS = new Set([
  "409a", "83b", "amt", "asc", "espp", "fica", "fmv", "hris", "ipo", "iso",
  "nso", "nqso", "psu", "qsbs", "rsa", "rsu", "sar", "w2",
]);

function normalizeToken(token: string): string {
  for (const [pattern, replacement] of NORMALIZED_TERMS) {
    if (pattern.test(token)) return replacement;
  }
  return token;
}

export function relevanceTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/w-2/g, "w2")
    .replace(/\b83\s*\(\s*b\s*\)|\b83\s*b\b/g, "83b")
    .match(/[a-z0-9]+/g) ?? [];
  return [...new Set(raw.filter((token) => token.length > 1 && !STOP_WORDS.has(token)).map(normalizeToken))];
}

function chunkText(chunk: RetrievalChunk): string {
  // A user-uploaded filename is citation metadata, not evidence. Keeping it
  // out of the confidence check prevents names such as "ISO-notes.pdf" from
  // making unrelated extracted text look grounded.
  return [chunk.tier === "user" ? undefined : chunk.title, chunk.headingPath, chunk.text, chunk.parentText]
    .filter(Boolean)
    .join(" ");
}

export function groundedEvidenceScore(query: string, chunk: RetrievalChunk): number {
  const queryTerms = relevanceTokens(query);
  if (!queryTerms.length) return 0;
  const evidence = new Set(relevanceTokens(chunkText(chunk)));
  return queryTerms.reduce((score, term) => {
    if (!evidence.has(term)) return score;
    return score + (HIGH_SIGNAL_TERMS.has(term) || /\d/.test(term) || term.length >= 6 ? 2 : 1);
  }, 0);
}

/**
 * The deploy-safe hash embedder is lexical rather than semantic. Its cosine
 * values are not calibrated like MiniLM, so confidence must be based on actual
 * query terms appearing in the retrieved evidence instead of a cosine cutoff.
 */
export function hasGroundedEvidence(query: string, chunks: RetrievalChunk[]): boolean {
  const queryTerms = relevanceTokens(query);
  if (!queryTerms.length || !chunks.length) return false;

  const allEvidence = new Set(relevanceTokens(chunks.map(chunkText).join(" ")));
  const matches = queryTerms.filter((term) => allEvidence.has(term));
  if (!matches.length) return false;

  if (matches.some((term) => HIGH_SIGNAL_TERMS.has(term) || /\d/.test(term))) return true;
  if (matches.some((term) => term.length >= 6)) return true;
  return matches.length >= 2 || matches.length / queryTerms.length >= 0.5;
}
