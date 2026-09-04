import { ALL_NODES, type TreeNode } from "../content/tree";
import { relevanceTokens } from "../rag/relevance";

export type DefinitionIntent = {
  kind: "definition";
  nodeId: string;
  title: string;
  facets?: QueryFacet[];
  topics?: string[];
};

export type QueryFacet =
  | "process"
  | "explanation"
  | "scenario"
  | "tax"
  | "lifecycle"
  | "timing"
  | "eligibility"
  | "mechanics"
  | "withholding"
  | "reporting"
  | "settlement";

/** Scope controls how much of the reviewed knowledge base belongs in an
 * answer. It is intentionally separate from `kind`: a definition can be
 * specific, while a general request can be broad or merely vague. */
export type QueryScope = "specific" | "multi-facet" | "broad" | "vague" | "unsupported";

type IntentMetadata = {
  facets?: QueryFacet[];
  topics?: string[];
  scope?: QueryScope;
};

export type QueryIntent =
  | (DefinitionIntent & IntentMetadata)
  | ({ kind: "comparison" } & IntentMetadata)
  | ({ kind: "general" } & IntentMetadata);

// These are meaningful equity signals. Generic context words such as
// "employee", "company", "share", "award", and "option" are deliberately
// absent so they cannot turn an unrelated question into a broad wiki answer.
const EQUITY_SCOPE_TERMS = new Set([
  "equity", "compensation", "stock", "stocks", "vesting", "vested", "exercise", "exercising",
  "iso", "nso", "rsu", "rsa", "espp", "psu", "sar", "phantom", "tax", "amt", "409a", "83b",
  "withholding", "payroll", "liquidity", "tender", "buyback", "ipo", "sale", "selling", "termination",
  "grant", "grants",
]);

/** Used only to choose a friendly no-answer explanation. It does not qualify
 * evidence: a query still needs grounded topic matches in `grounding.ts`. */
export function isClearlyOffTopicQuery(query: string): boolean {
  const terms = relevanceTokens(query);
  return terms.length > 0 && !terms.some((term) => EQUITY_SCOPE_TERMS.has(term));
}

const FACET_PATTERNS: Array<[QueryFacet, RegExp]> = [
  ["process", /\bhow\b|\bprocess\b|\bsteps?\b|\bwork\b/i],
  ["explanation", /\bwhy\b|\breason\b|\bpurpose\b/i],
  ["scenario", /\bwhat happens\b|\bif\b|\bafter\b|\bwhen\b/i],
  ["tax", /\btax(?:es|ed|ation)?\b|\bamt\b|\b409a\b|\b83\s*\(?b\)?\b|\bbasis\b/i],
  ["lifecycle", /\bgrant\b|\bvest(?:ing|ed)?\b|\bexercise\b|\btermination\b|\bliquidity\b|\bsale\b/i],
  ["timing", /\bwhen\b|\bdeadline\b|\bwindow\b|\bholding period\b|\bterm\b/i],
  ["eligibility", /\bwho\b|\beligible\b|\beligibility\b|\bqualif(?:y|ies|ied)\b/i],
  ["mechanics", /\bhow\b|\bwork\b|\bstructure\b|\bmechanic(?:s)?\b/i],
  ["withholding", /\bwithhold(?:ing)?\b|\bpayroll\b|\bsell-to-cover\b/i],
  ["reporting", /\breport(?:ing)?\b|\bform\s+(?:w-?2|3921|3922)\b/i],
  ["settlement", /\bsettle(?:ment|d)?\b|\bdelivery\b|\bclose(?:s|d|ing)?\b/i],
];

export function queryFacets(query: string): QueryFacet[] {
  return FACET_PATTERNS.filter(([, pattern]) => pattern.test(query)).map(([facet]) => facet);
}

const TOPIC_ALIASES: Array<[string, RegExp]> = [
  ["ISO", /\bisos?\b/i],
  ["NSO", /\b(?:nsos?|nqsos?)\b/i],
  ["RSU", /\brsus?\b/i],
  ["RSA", /\brsas?\b/i],
  ["ESPP", /\bespps?\b/i],
  ["PSU", /\bpsus?\b/i],
  ["SAR", /\bsars?\b/i],
  ["83(b)", /\b83\s*\(?b\)?\b/i],
  ["409A", /\b409a\b/i],
  ["ASC 718", /\basc\s*(?:topic\s*)?718\b/i],
  ["AMT", /\bamt\b/i],
  ["tender offer", /\btender\s+offer\b/i],
  ["liquidity", /\bliquidity\b|\bbuyback\b|\bsecondary sale/i],
  ["sale", /\bsell(?:ing|s)?\b|\bsold\b|\bsale\b/i],
  ["vesting", /\bvest(?:ing|ed|s)?\b/i],
  ["exercise", /\bexercis(?:e|ed|ing|es)\b/i],
  ["termination", /\bterminat(?:e|ed|ion|ions|ing)\b/i],
];

export function queryTopics(query: string): string[] {
  return TOPIC_ALIASES.filter(([, pattern]) => pattern.test(query)).map(([topic]) => topic);
}

const BROAD_SUBJECT_PATTERNS = [
  /\bequity\s+compensation\b/i,
  /\bequity\s+awards?\b/i,
  /\bstock\s+options?\b/i,
  /\bshare[-\s]?based\s+compensation\b/i,
  /\b(?:explain|describe|tell\s+me\s+about|overview\s+of)\s+(?:equity|stock|share|option|award|iso|nso|rsu|rsa|espp|psu|sar|phantom)\b/i,
  /\b(?:all|everything)\s+about\b/i,
  /\b(?:overview|big picture|what should i know)\b/i,
];

function hasEquityScopeTerm(query: string): boolean {
  return relevanceTokens(query).some((term) => EQUITY_SCOPE_TERMS.has(term));
}

/** Classifies breadth without making another model call. This is used by both
 * retrieval and composition so broad prompts can be comprehensive while a
 * narrow rule stays focused. */
export function classifyQueryScope(
  query: string,
  metadata: { kind?: QueryIntent["kind"]; facets?: QueryFacet[]; topics?: string[] } = {}
): QueryScope {
  if (isClearlyOffTopicQuery(query)) return "unsupported";
  const facets = metadata.facets ?? queryFacets(query);
  const topics = metadata.topics ?? queryTopics(query);
  if (metadata.kind === "comparison" || /\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query)) {
    return "specific";
  }
  if (BROAD_SUBJECT_PATTERNS.some((pattern) => pattern.test(query))) return "broad";
  if (facets.length >= 2) return "multi-facet";
  if (topics.length > 0 || facets.length > 0) return "specific";
  if (hasEquityScopeTerm(query)) return "vague";
  return "unsupported";
}

/** Returns the scope attached to an intent, with a conservative fallback for
 * callers that construct the older `{ kind, facets, topics }` shape directly. */
export function queryScope(intent: QueryIntent, query = ""): QueryScope {
  return intent.scope ?? classifyQueryScope(query, intent);
}

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
  const facets = queryFacets(query);
  const topics = queryTopics(query);
  if (/\b(?:vs\.?|versus|compare|comparison|difference between)\b/i.test(query)) {
    return { kind: "comparison", facets, topics, scope: classifyQueryScope(query, { kind: "comparison", facets, topics }) };
  }
  const definition = resolveDefinitionTopic(query);
  if (definition) {
    return {
      kind: "definition",
      nodeId: definition.id,
      title: definition.title,
      facets,
      topics,
      scope: facets.length > 0
        ? "multi-facet"
        : BROAD_SUBJECT_PATTERNS.some((pattern) => pattern.test(query)) ? "broad" : "specific",
    };
  }
  return {
    kind: "general",
    facets,
    topics,
    scope: classifyQueryScope(query, { kind: "general", facets, topics }),
  };
}

export function buildDefinitionRetrievalQuery(query: string, topic: TreeNode): string {
  return `${query} ${topic.title} definition overview`;
}
