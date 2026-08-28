import { normalizeGeneratedText } from "../llm/output-normalizer";
import type { ComparisonData } from "../llm/types";
import { shortenTitle } from "../llm/title";

function safeSubjectText(value: string): string {
  return normalizeGeneratedText(value)
    .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionText(value: string): string {
  const cleaned = safeSubjectText(value);
  if (!cleaned) return "Your EquityIQ answer";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}?`;
}

export function buildEmailSubject(input: {
  question?: string;
  title: string;
  comparison?: ComparisonData;
}): string {
  const prefix = input.comparison ? "EquityIQ comparison: " : "EquityIQ answer: ";
  const subject = input.comparison
    ? `${prefix}${input.comparison.columns.map(safeSubjectText).join(" vs. ")}`
    : `${prefix}${questionText(input.question || input.title)}`;
  return shortenTitle(subject, 120).replace(/[\r\n]/g, " ").trim();
}
