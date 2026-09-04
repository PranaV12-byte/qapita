import { isComparisonQuery } from "./grounding";
import { queryTopics } from "./query-intent";

const MAX_QUESTION_PARTS = 4;
const QUESTION_START = /\b(?:what\s+(?:is|are)|how\s+(?:do|does|are|is)|why\s+(?:do|does|is|are)|when\s+(?:do|does|is|are)|who\s+(?:is|are)|can\s+|does\s+|do\s+|are\s+|is\s+|should\s+|will\s+)/gi;

export type QueryBatch = {
  parts: string[];
  tooMany: boolean;
};

function normalizeQuestion(value: string): string {
  const text = value.replace(/\s+/g, " ").trim().replace(/^[,.:;\-]+\s*/, "");
  if (!text) return "";
  return /[?!.]$/.test(text) ? text : `${text}?`;
}

function splitQuestionStarters(value: string): string[] {
  const starts = [...value.matchAll(QUESTION_START)].map((match) => match.index ?? 0);
  if (starts.length <= 1) return [value];
  return starts.map((start, index) => value.slice(start, starts[index + 1]).trim()).filter(Boolean);
}

function expandDefinitionTopics(part: string): string[] {
  if (isComparisonQuery(part)) return [part];
  if (!/^\s*(?:what\s+(?:is|are)|define|explain)\b/i.test(part)) return [part];
  const topics = queryTopics(part);
  if (topics.length < 2) return [part];
  return topics.map((topic) => normalizeQuestion(`What is ${topic}`));
}

/** Splits only clearly independent questions. A coordinated tax or comparison
 * question remains one retrieval unit so its evidence is not accidentally split. */
export function splitIndependentQuestions(query: string): QueryBatch {
  const punctuated = query
    .split(/[?;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const clauses = (punctuated.length > 1 ? punctuated : splitQuestionStarters(query))
    .flatMap(expandDefinitionTopics)
    .map(normalizeQuestion)
    .filter(Boolean);
  const unique = [...new Set(clauses.map((part) => part.toLowerCase()))]
    .map((key) => clauses.find((part) => part.toLowerCase() === key)!)
    .slice(0, MAX_QUESTION_PARTS + 1);
  return { parts: unique.slice(0, MAX_QUESTION_PARTS), tooMany: unique.length > MAX_QUESTION_PARTS };
}

export const MULTI_QUESTION_LIMIT_MESSAGE =
  "Please narrow this request to four questions or fewer so EquityIQ can answer each part reliably.";

export const PARTIAL_CONTENT_GAP_MESSAGE =
  "EquityIQ does not have enough verified guidance to answer this part confidently yet. Try adding more detail or asking it separately.";
