export const DEFAULT_PLACEHOLDER =
  'Describe the drafting need, for example: "Explain why taxes were withheld at RSU vesting."';

export function getNodePlaceholder(title: string): string {
  return `Prepare a draft grounded in ${title}.`;
}

export function isSubmitDisabled(query: string, loading: boolean): boolean {
  return query.trim().length === 0 || loading;
}

/**
 * Older API responses did not include answerAvailable, so an omitted value is
 * treated as a normal answer. The current API sends false only for the
 * deliberate, grounded "not enough information" result.
 */
export function canDeliverGeneratedAnswer(answerAvailable?: boolean): boolean {
  return answerAvailable !== false;
}

export function getCopyLabel(copied: boolean): string {
  return copied ? "Copied" : "Copy text";
}

function plainAnswerText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function copyKey(value: string): string {
  return plainAnswerText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clipboard text deliberately comes from the displayed artifact, not the
 * short social-share field. That keeps long, evidence-backed answers intact
 * and makes native clipboard and selection fallback copy the same content.
 */
export function buildArtifactCopyText(question: string, bodyMarkdown: string): string {
  const blocks = bodyMarkdown.trim().split(/\n{2,}/);
  const first = blocks[0] ?? "";
  const answer = copyKey(first) === copyKey(question)
    ? blocks.slice(1).join("\n\n")
    : bodyMarkdown;
  return `${question.trim()}\n\n${plainAnswerText(answer)}`.trim();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
