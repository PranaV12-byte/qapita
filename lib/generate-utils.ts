export const DEFAULT_PLACEHOLDER =
  'Describe the problem — e.g. "An employee is asking why taxes were withheld at vest"';

export function getNodePlaceholder(title: string): string {
  return `What do you need to explain about ${title}?`;
}

export function isSubmitDisabled(query: string, loading: boolean): boolean {
  return query.trim().length === 0 || loading;
}

export function getCopyLabel(copied: boolean): string {
  return copied ? "Copied ✓" : "Copy text";
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
