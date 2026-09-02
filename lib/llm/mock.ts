import type { ArtifactResult, GenerateOptions, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk, Citation } from "@/lib/rag/types";
import { getNode } from "../content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE, FALLBACK_THRESHOLD } from "../rag/config";
import { hasGroundedEvidence } from "../rag/relevance";
import { titleFromQuery } from "./title";
import {
  buildGroundedComparison,
  comparisonToMarkdown,
  comparisonToQuickShare,
  wantsStructuredComparison,
} from "./comparison";
import { composeWikiAnswer } from "./answer-composer";

/** Exported so lib/llm/groq.ts can enforce quickShare's "concise plaintext"
 *  contract as a backstop, the same way it enforces tone via cleanProse. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

/** Em/en-dash and inline-dash punctuation cleanup, no whitespace collapsing
 *  and no forced terminal period. Safe to run on a single markdown LINE
 *  (header, bullet, or prose) without disturbing line structure. */
function cleanPunctuation(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, " - ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s+,/g, ",")
    .trim();
}

/** Professional-prose cleanup for OUR OWN generated text (not a copyright
 *  concern  -  this normalizes punctuation, it doesn't paraphrase facts). Only
 *  safe for a SINGLE paragraph/sentence fragment: it collapses all internal
 *  whitespace (including newlines), so it must never be run on multi-line
 *  markdown  -  use cleanProseMarkdown for that. */
export function cleanProse(text: string): string {
  return cleanPunctuation(text.replace(/\s+/g, " "))
    .trim()
    .replace(/([^.!?"')\]])$/, "$1.");
}

/** Same punctuation cleanup as cleanProse, but LINE-aware: preserves markdown
 *  structure (headers, bullets, numbered lists, blank lines) instead of
 *  collapsing the whole text to one line. Exported as the deterministic
 *  backstop for LLM-generated multi-paragraph bodyMarkdown in
 *  lib/llm/groq.ts, since a prompt instruction is a request, not a guarantee. */
export function cleanProseMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return "";
      const m = line.match(/^(\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+))?(.*)$/);
      const prefix = m?.[1] ?? "";
      const rest = cleanPunctuation(m?.[2] ?? line);
      const isHeading = /^#{1,6}\s/.test(prefix);
      const finished = isHeading || rest === "" ? rest : rest.replace(/([^.!?"')\]:;])$/, "$1.");
      return prefix + finished;
    })
    .join("\n");
}

/** Display label for a chunk's node  -  our own taxonomy label, never source text. */
function nodeLabel(nodeId?: string): string | null {
  if (!nodeId) return null;
  if (nodeId === GENERAL_NODE_ID) return GENERAL_NODE_TITLE;
  return getNode(nodeId)?.title ?? null;
}

/** Distinct {nodeId, title} for a set of chunks, preserving order. Exported:
 *  lib/llm/groq.ts uses this to resolve citation titles from our OWN taxonomy
 *  rather than trusting whatever title string the model returns. */
export function distinctNodes(chunks: RetrievalChunk[]): { nodeId: string; title: string }[] {
  const seen = new Set<string>();
  const out: { nodeId: string; title: string }[] = [];
  for (const c of chunks) {
    const label = nodeLabel(c.nodeId);
    if (c.nodeId && label && !seen.has(c.nodeId)) {
      seen.add(c.nodeId);
      out.push({ nodeId: c.nodeId, title: label });
    }
  }
  return out;
}

/** Distinct citations for user-uploaded chunks, keyed by sourceId. User topics
 *  do not have canonical taxonomy labels, so source handling stays separate
 *  from `nodeLabel` and remains available to all fallback callers. */
export function distinctUserSources(chunks: RetrievalChunk[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of chunks) {
    if (!c.sourceId || seen.has(c.sourceId)) continue;
    seen.add(c.sourceId);
    out.push({ kind: "source", sourceId: c.sourceId, title: c.title ?? "Your source" });
  }
  return out;
}

/** A short, honest "not confidently covered" response  -  replaces dumping a
 *  weak, likely off-topic answer when nothing clears FALLBACK_THRESHOLD.
 *  Exported so lib/llm/groq.ts can short-circuit to the SAME message instead
 *  of spending an API call asking an LLM to police its own confidence. */
export const GRACEFUL_UNKNOWN_BODY =
  "EquityIQ does not have enough verified guidance to answer this confidently yet. " +
  "Try adding a little more detail or asking the question another way.";

export const GRACEFUL_COMPARISON_BODY =
  "Try naming two to four equity topics you want to compare. " +
  "Each topic must be covered by the available guidance.";

export const GRACEFUL_OFF_TOPIC_BODY =
  "EquityIQ is designed for equity compensation questions. " +
  "Try asking about awards, vesting, exercise, taxes, liquidity, or reporting.";

export function gracefulUnknown(query: string): ArtifactResult {
  const title = titleFromQuery(query);
  const body = GRACEFUL_UNKNOWN_BODY;
  return { title, bodyMarkdown: body, citations: [], quickShare: `${title}\n\n${body}` };
}

export function gracefulComparisonRefinement(query: string): ArtifactResult {
  const title = titleFromQuery(query);
  return { title, bodyMarkdown: GRACEFUL_COMPARISON_BODY, citations: [], quickShare: `${title}\n\n${GRACEFUL_COMPARISON_BODY}` };
}

export function gracefulOffTopic(query: string): ArtifactResult {
  const title = titleFromQuery(query);
  return { title, bodyMarkdown: GRACEFUL_OFF_TOPIC_BODY, citations: [], quickShare: `${title}\n\n${GRACEFUL_OFF_TOPIC_BODY}` };
}

export function isGracefulUnknownArtifact(artifact: ArtifactResult): boolean {
  return artifact.citations.length === 0 &&
    (artifact.bodyMarkdown.trim() === GRACEFUL_UNKNOWN_BODY ||
      artifact.bodyMarkdown.trim() === GRACEFUL_COMPARISON_BODY ||
      artifact.bodyMarkdown.trim() === GRACEFUL_OFF_TOPIC_BODY);
}

/** Exported so lib/llm/groq.ts can apply the identical confidence gate before
 *  ever calling the LLM  -  retrieval quality, not model behavior, decides
 *  whether a question is answerable. */
export const bestCosine = (cs: RetrievalChunk[]): number =>
  cs.reduce((max, c) => Math.max(max, c.cosine ?? 0), 0);

export class MockLLM implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[],
    opts: GenerateOptions = {}
  ): Promise<ArtifactResult> {
    const title = titleFromQuery(query);
    const curated = chunks.filter((c) => c.tier === "curated");
    const scrape = chunks.filter((c) => c.tier === "scrape");
    const user = chunks.filter((c) => c.tier === "user");

    if (wantsStructuredComparison(query, opts.format)) {
      const comparison = buildGroundedComparison(query, chunks.filter((chunk) => chunk.tier !== "scrape"));
      if (!comparison) return gracefulComparisonRefinement(query);
      const comparisonTitle = comparison.title || title;
      return {
        title: comparisonTitle,
        bodyMarkdown: comparisonToMarkdown(comparison),
        citations: [...distinctNodes(curated), ...distinctUserSources(user)],
        quickShare: comparisonToQuickShare(comparison),
        comparison,
      };
    }

    // User uploads and reviewed Wiki sections use the same answer composer. This
    // keeps provenance in structured citations without turning the answer into a
    // list of source labels and excerpts.
    if (user.length > 0) {
      const topicCitations = distinctNodes(curated);
      const sourceCitations = distinctUserSources(user);
      const citations: Citation[] = [...topicCitations, ...sourceCitations];
      const composed = composeWikiAnswer(query, [...curated, ...user], opts.queryIntent ?? { kind: "general" });
      if (!composed) return gracefulUnknown(query);
      return { title, bodyMarkdown: composed.bodyMarkdown, citations, quickShare: composed.quickShare };
    }

    // ── Curated path: safe to summarize our own reviewed content, but only
    // when the best match actually clears the confidence bar (the same bar
    // retrieval itself uses for fallbackUsed)  -  otherwise this falls through
    // to the graceful "I don't know" below instead of forcing a tangential
    // answer out of weak matches. ──
    if (curated.length > 0 && (bestCosine(curated) >= FALLBACK_THRESHOLD || hasGroundedEvidence(query, curated))) {
      const composed = composeWikiAnswer(query, curated, opts.queryIntent ?? { kind: "general" });
      if (!composed) return gracefulUnknown(query);
      return { title, bodyMarkdown: composed.bodyMarkdown, citations: distinctNodes(curated), quickShare: composed.quickShare };
    }

    // Scraped material is retained for retrieval experiments, but it is not
    // reviewed evidence. It must never become the answer when no curated or
    // user-provided section can support the response.
    if (scrape.length > 0) return gracefulUnknown(query);

    // ── Nothing retrieved, or nothing cleared the confidence bar: an honest
    // "I don't know" rather than a forced, likely-wrong answer. ──
    return gracefulUnknown(query);
  }
}
