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

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
