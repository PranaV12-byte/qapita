import { isComparisonQuery } from "./grounding";
import { queryTopics } from "./query-intent";

// Match complete question openers, not every occurrence of words such as
// "are" or "is" inside a sentence. The context check below then limits these
// openers to the beginning of a clause, so "if the shares are not sold" stays
// part of the original question.
const QUESTION_START = /\b(?:what\s+(?:is|are|was|were|happens|if)|how\s+(?:do|does|are|is)|why\s+(?:do|does|is|are)|when\s+(?:do|does|is|are)|who\s+(?:is|are)|can\b|does\b|do\b|are\b|is\b|should\b|will\b)/gi;
const QUESTION_START_AT_START = new RegExp(`^${QUESTION_START.source}`, "i");
const QUESTION_BOUNDARY_PREFIX = /(?:^|\s+(?:and|or|but)\s+|[,;]\s*|[.!?\n]\s*)$/i;

function startsQuestion(value: string): boolean {
  return QUESTION_START_AT_START.test(value.trim());
}

function inheritsPreviousSubject(piece: string): boolean {
  const remainder = piece
    .replace(/^(?:what\s+(?:is|are|was|were|happens|if)|how\s+(?:do|does|are|is)|why\s+(?:do|does|is|are)|when\s+(?:do|does|are|is)|who\s+(?:is|are)|can\b|does\b|do\b|are\b|is\b|should\b|will\b)\s+/i, "")
    .trim();
  return /^(?:it|they|he|she|this|that|these|those|the same|after|before|during|whether|if)\b/i.test(remainder);
}

function splitExplicitBoundaries(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  const boundaries = /[?;\n]+/g;
  for (const match of value.matchAll(boundaries)) {
    const boundaryEnd = (match.index ?? 0) + match[0].length;
    const after = value.slice(boundaryEnd);
    // A question mark is an explicit end. Semicolons and line breaks are only
    // separators when the next clause clearly starts another question; this
    // preserves coordinated qualifiers such as "compare A and B; focus on tax".
    if (!match[0].includes("?") && !startsQuestion(after)) continue;
    const part = value.slice(start, match.index ?? 0).trim();
    if (part) parts.push(part);
    start = boundaryEnd;
  }
  const remainder = value.slice(start).trim();
  if (remainder) parts.push(remainder);

  // Keep a follow-up clause with its antecedent when it starts with a pronoun
  // or an inherited condition, for example “What is an ISO? What happens if
  // it is exercised?” The combined unit preserves the topic for retrieval.
  return parts.reduce<string[]>((merged, part) => {
    if (merged.length > 0 && inheritsPreviousSubject(part)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}? ${part}`;
    } else {
      merged.push(part);
    }
    return merged;
  }, []);
}

export type QueryBatch = {
  parts: string[];
};

function normalizeQuestion(value: string): string {
  const text = value.replace(/\s+/g, " ").trim().replace(/^[,.:;\-]+\s*/, "");
  if (!text) return "";
  return /[?!.]$/.test(text) ? text : `${text}?`;
}

function splitQuestionStarters(value: string): string[] {
  const starts = [...value.matchAll(QUESTION_START)]
    .filter((match) => QUESTION_BOUNDARY_PREFIX.test(value.slice(0, match.index ?? 0)))
    .map((match) => match.index ?? 0);
  if (starts.length <= 1) return [value];
  const pieces = starts
    .map((start, index) => value.slice(start, starts[index + 1]).trim())
    .map((piece) => piece.replace(/\s+(?:and|or|but)\s*$/i, "").trim())
    .filter(Boolean);

  // A question such as "What is an ISO and how is it taxed?" is one
  // coordinated issue. Split only a sequence of definition starters, where
  // each clause can be independently grounded (the common multi-topic case).
  const allDefinitions = pieces.every((piece) => /^what\s+(?:is|are|was|were)\b/i.test(piece));
  if (allDefinitions) return pieces;

  // Split repeated starters only when each clause names its own topic. A
  // clause such as “and how is it taxed?” inherits the subject of the first
  // clause and must stay together; two clauses that name ISO and RSU, for
  // example, are independently retrievable questions.
  const clauseTopics = pieces.map((piece) => queryTopics(piece));
  const hasIndependentTopics = pieces.every((piece) => !inheritsPreviousSubject(piece)) &&
    clauseTopics.every((topics) => topics.length > 0) &&
    new Set(clauseTopics.flat()).size > 1;
  return hasIndependentTopics ? pieces : [value];
}

function expandDefinitionTopics(part: string): string[] {
  if (isComparisonQuery(part)) return [part];
  if (!/^\s*(?:what\s+(?:is|are)|define|explain)\b/i.test(part)) return [part];
  const explicitClauses = part.split(/[?!]/).map((clause) => clause.trim()).filter(Boolean);
  if (explicitClauses.length > 1 && explicitClauses.some((clause) =>
    !/^\s*(?:what\s+(?:is|are)|define)\b/i.test(clause))) return [part];
  const topics = queryTopics(part);
  if (topics.length < 2) return [part];
  return topics.map((topic) => normalizeQuestion(`What is ${topic}`));
}

/** Splits only clearly independent questions. A coordinated tax or comparison
 * question remains one retrieval unit so its evidence is not accidentally split. */
export function splitIndependentQuestions(query: string): QueryBatch {
  const punctuated = splitExplicitBoundaries(query);
  const clauses = (punctuated.length > 1 ? punctuated : splitQuestionStarters(query))
    .flatMap(expandDefinitionTopics)
    .map(normalizeQuestion)
    .filter(Boolean);
  const unique = [...new Set(clauses.map((part) => part.toLowerCase()))]
    .map((key) => clauses.find((part) => part.toLowerCase() === key)!)
  return { parts: unique };
}

export const PARTIAL_CONTENT_GAP_MESSAGE =
  "EquityIQ does not have enough verified guidance to answer this part confidently yet. Try adding more detail or asking it separately.";
