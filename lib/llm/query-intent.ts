import { ALL_NODES, type TreeNode } from "../content/tree";

export type DefinitionIntent = {
  kind: "definition";
  nodeId: string;
  title: string;
};

export type QueryIntent = DefinitionIntent | { kind: "comparison" } | { kind: "general" };

function normalizeSubject(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[()[\]{}]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:a|an|the)\s+/, "");
}

function singularize(value: string): string {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("ses") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

function aliasesForNode(node: TreeNode): string[] {
  const aliases = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeSubject(value);
    if (!normalized) return;
    aliases.add(normalized);
    aliases.add(normalized.split(" ").map(singularize).join(" "));
  };

  add(node.title);
  add(node.slug.replace(/-/g, " "));

  const parenthetical = node.title.match(/\(([^)]+)\)/g) ?? [];
  parenthetical.forEach((value) => add(value));

  // Bundled taxonomy labels such as "RSUs & RSAs" are exact aliases for
  // either named award type, not fuzzy matches for arbitrary related words.
  node.title
    .split(/\s+(?:and|&)\s+|\s*,\s*/i)
    .map((part) => part.replace(/\([^)]*\)/g, ""))
    .forEach(add);

  return [...aliases];
}

function definitionSubject(query: string): string | null {
  const cleaned = query.replace(/\s+/g, " ").trim().replace(/[?!.:;]+$/, "").trim();
  const match = cleaned.match(
    /^(?:what|who)\s+(?:is|are|was|were)\s+(.+)$/i
  ) ?? cleaned.match(/^define\s+(.+)$/i)
    ?? cleaned.match(/^explain\s+(?:what\s+)?(?:is|are)?\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Resolve only exact, simple definition questions to a canonical taxonomy
 * node. No fuzzy matching is used, so a longer question cannot accidentally
 * suppress relevant general or user-uploaded evidence. */
export function resolveDefinitionTopic(query: string): TreeNode | null {
  if (/\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query)) return null;
  const subject = definitionSubject(query);
  if (!subject) return null;
  const normalized = normalizeSubject(subject);
  if (!normalized || normalized.split(" ").length > 8) return null;

  return ALL_NODES.find((node) => aliasesForNode(node).includes(normalized)) ?? null;
}

export function getQueryIntent(query: string): QueryIntent {
  if (/\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query)) {
    return { kind: "comparison" };
  }
  const definition = resolveDefinitionTopic(query);
  return definition
    ? { kind: "definition", nodeId: definition.id, title: definition.title }
    : { kind: "general" };
}

export function buildDefinitionRetrievalQuery(query: string, topic: TreeNode): string {
  return `${query} ${topic.title} definition overview`;
}
