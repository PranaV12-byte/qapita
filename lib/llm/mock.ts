import type { ArtifactResult, GenerateOptions, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk, Citation, Embedder } from "@/lib/rag/types";
import { getNode } from "@/lib/content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE, FALLBACK_THRESHOLD } from "@/lib/rag/config";
import { getEmbedder } from "@/lib/rag/embedder";
import { cosineSimilarity } from "@/lib/rag/cosine";

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

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Em/en-dash and inline-dash punctuation cleanup, no whitespace collapsing
 *  and no forced terminal period — safe to run on a single markdown LINE
 *  (header, bullet, or prose) without disturbing line structure. */
function cleanPunctuation(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/([a-zA-Z0-9)])\s-\s(?=[a-zA-Z(])/g, "$1; ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s+,/g, ",")
    .trim();
}

/** Professional-prose cleanup for OUR OWN generated text (not a copyright
 *  concern — this normalizes punctuation, it doesn't paraphrase facts). Only
 *  safe for a SINGLE paragraph/sentence fragment: it collapses all internal
 *  whitespace (including newlines), so it must never be run on multi-line
 *  markdown — use cleanProseMarkdown for that. */
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
      const finished = isHeading || rest === "" ? rest : rest.replace(/([^.!?"')\]])$/, "$1.");
      return prefix + finished;
    })
    .join("\n");
}

function firstSentences(text: string, n: number): string {
  const normalized = text.replace(/\r?\n+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]*[.!?]+(?:\s|$)/g) ?? [normalized];
  const result = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, n)
    .join(" ")
    .trim();
  return capitalize(cleanProse(result || normalized.slice(0, 200).trim()));
}

/** Split normalized text into candidate sentences, dropping fragments: too
 *  short, or missing a capital/quote/bold start (usually an overlap-seeded
 *  mid-sentence tail) — the same shape of noise dedupeSections targets, but
 *  at sentence granularity. */
function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const raw = normalized.match(/[^.!?]*[.!?]+(?:\s|$)/g) ?? [normalized];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && /^["*A-Z(]/.test(s));
}

/** Drop overlapping/near-duplicate fragments: keep the FIRST chunk of each
 *  parent section (later ones are overlap tails that read as mid-sentence
 *  noise), preserving relevance order. Falls back to nodeId, then text. */
function dedupeSections(chunks: RetrievalChunk[]): RetrievalChunk[] {
  const seen = new Set<string>();
  const out: RetrievalChunk[] = [];
  for (const c of chunks) {
    const key = c.parentId ?? c.nodeId ?? c.text.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** The core fix for on-topic answers: section-level cosine tells us which
 *  SECTION best matches the query, but a section can be the best match
 *  overall while only PART of it (or none of it) answers the actual
 *  question — that's the "useless first paragraph" bug. Scoring individual
 *  SENTENCES against the query and keeping only the closely-relevant ones
 *  fixes this at the source, for every query, not just definitional ones.
 *  Falls back to the old section-level extraction when there's nothing to
 *  usefully embed (e.g. unit-test chunks with no parentText / too few
 *  candidate sentences) so tests stay fast and deterministic. */
async function composeSentenceAnswer(
  query: string,
  rankedSections: RetrievalChunk[],
  embedder: Embedder
): Promise<{ bodyMarkdown: string; quickShare: string }> {
  const pool = rankedSections.slice(0, 6);

  type Cand = { sectionIdx: number; text: string; order: number };
  const candidates: Cand[] = [];
  pool.forEach((c, sectionIdx) => {
    splitSentences(c.parentText ?? c.text).forEach((s, order) => {
      candidates.push({ sectionIdx, text: s, order });
    });
  });

  if (candidates.length < 2) {
    const paras = pool.slice(0, 4).map((c) => firstSentences(c.parentText ?? c.text, 4));
    const plainParas = pool
      .slice(0, 4)
      .map((c) => firstSentences(stripMarkdown(c.parentText ?? c.text), 4));
    return { bodyMarkdown: paras.join("\n\n"), quickShare: plainParas.join(" ") };
  }

  const [queryVec, sentenceVecs] = await Promise.all([
    embedder.embedQuery(query),
    embedder.embedPassages(candidates.map((c) => c.text)),
  ]);
  const scored = candidates.map((c, i) => ({
    ...c,
    score: cosineSimilarity(queryVec, sentenceVecs[i]),
  }));
  scored.sort((a, b) => b.score - a.score);

  // A bi-encoder's top cosine match for a short "what is X" query is often a
  // detail sentence that happens to be lexically dense (e.g. "ISOs can only
  // be granted by corporations..."), not the actual definition — MiniLM
  // scores short, keyword-heavy sentences highly regardless of whether they
  // define the term. For definitional queries, force the definition sentence
  // to lead: pick the highest-scoring candidate that reads like a definition
  // ("X is/are a/an/the ...") and anchor it first, so the answer states what
  // the term IS before adding supporting detail.
  const isDefinitionalQuery = /^(what|who)\s+(is|are|was|were)\b|^define\b|^explain what\b/i.test(
    query.trim()
  );
  // Requires the indefinite article ("is/are a/an") right after the copula —
  // the hallmark of "X is a/an Y" definitions — not just any "is the ..."
  // factual statement, which is common in non-definitional sentences too.
  const looksLikeDefinition = (s: string) => /^.{0,55}?\b(is|are)\s+(a|an|any)\b/i.test(s);
  const anchor = isDefinitionalQuery
    ? scored.find((s) => looksLikeDefinition(s.text))
    : undefined;

  const RELEVANCE_GAP = 0.12;
  // Guarantee at least MIN_SENTENCES (subject to availability/MAX_CHARS)
  // before the relevance gate applies, so a verbose, well-developed answer
  // is the default rather than stopping after the first couple of matches —
  // the gate still protects against genuine tangents once past this floor.
  const MIN_SENTENCES = 5;
  const MAX_SENTENCES = 10;
  const MAX_CHARS = 1500;
  const topScore = scored[0].score;
  const kept: typeof scored = [];
  let chars = 0;
  if (anchor) {
    kept.push(anchor);
    chars += anchor.text.length;
  }
  for (const s of scored) {
    if (s === anchor) continue;
    if (kept.length >= MAX_SENTENCES || chars >= MAX_CHARS) break;
    if (kept.length >= MIN_SENTENCES && s.score < topScore - RELEVANCE_GAP) continue;
    kept.push(s);
    chars += s.text.length;
  }

  // Restore reading order (section rank, then original position within the
  // section) so supporting sentences read as coherent prose, and group
  // contiguous same-section sentences into one paragraph. The anchor (if any)
  // always leads, ahead of its own section's other sentences.
  const rest = kept.filter((s) => s !== anchor);
  rest.sort((a, b) => a.sectionIdx - b.sectionIdx || a.order - b.order);
  const paras: string[] = [];
  let currentSection = anchor?.sectionIdx ?? -1;
  let buf: string[] = anchor ? [anchor.text] : [];
  for (const s of rest) {
    if (s.sectionIdx !== currentSection && buf.length > 0) {
      paras.push(buf.join(" "));
      buf = [];
    }
    currentSection = s.sectionIdx;
    buf.push(s.text);
  }
  if (buf.length > 0) paras.push(buf.join(" "));

  const cleaned = paras.map((p) => capitalize(cleanProse(p)));
  const plain = cleaned.map((p) => capitalize(cleanProse(stripMarkdown(p))));
  return { bodyMarkdown: cleaned.join("\n\n"), quickShare: plain.join(" ") };
}

/** Display label for a chunk's node — our own taxonomy label, never source text. */
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

/** Distinct citations for user-uploaded chunks, keyed by sourceId. Explicit
 *  handling (not nodeLabel, which returns null for "u-" node ids) is the fix
 *  for the confirmed pre-Phase-4 bug where user citations were dropped.
 *  Exported for the same reason as distinctNodes above. */
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

/** A short, honest "not confidently covered" response — replaces dumping a
 *  weak, likely off-topic answer when nothing clears FALLBACK_THRESHOLD.
 *  Exported so lib/llm/groq.ts can short-circuit to the SAME message instead
 *  of spending an API call asking an LLM to police its own confidence. */
export function gracefulUnknown(query: string): ArtifactResult {
  const title = `Reference: ${query.slice(0, 80)}`;
  const body =
    "I don't have enough grounded information in the knowledge base to answer that confidently. " +
    "Try rephrasing the question, or add a source that covers it and ask again.";
  return { title, bodyMarkdown: body, citations: [], quickShare: `${title}\n\n${body}` };
}

/** Exported so lib/llm/groq.ts can apply the identical confidence gate before
 *  ever calling the LLM — retrieval quality, not model behavior, decides
 *  whether a question is answerable. */
export const bestCosine = (cs: RetrievalChunk[]): number =>
  cs.reduce((max, c) => Math.max(max, c.cosine ?? 0), 0);

export class MockLLM implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[],
    opts: GenerateOptions = {}
  ): Promise<ArtifactResult> {
    if (process.env.MOCK_DELAY !== "false") {
      const delay = 1200 + (Math.random() * 600 - 300);
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    const title = opts.format === "email"
      ? `Email draft: ${query.slice(0, 72)}`
      : opts.format === "comparison"
        ? `Comparison: ${query.slice(0, 72)}`
        : `Reference: ${query.slice(0, 80)}`;
    const curated = chunks.filter((c) => c.tier === "curated");
    const scrape = chunks.filter((c) => c.tier === "scrape");
    const user = chunks.filter((c) => c.tier === "user");

    // ── User path: the wiki has the user's own uploads. Under the Phase-4
    // quoting policy their content IS quotable back to them, WITH attribution.
    // Only reached when a brain delta contributed chunks — the empty-brain
    // paths below stay byte-identical to the pre-Second-Brain baseline. ──
    if (user.length > 0) {
      const userBullets = user
        .slice(0, 5)
        .map((c) => `- From **${c.title ?? "your source"}**: ${firstSentences(c.text, 1)}`)
        .join("\n");

      const topicCitations = distinctNodes([...curated, ...scrape]);
      const sourceCitations = distinctUserSources(user);
      const citations: Citation[] = [...topicCitations, ...sourceCitations];

      const relatedBlock =
        curated.length > 0
          ? ["", "## Related curated topics", distinctNodes(curated).map((c) => `- ${c.title}`).join("\n")]
          : [];

      const bodyMarkdown = [
        `Here's what your wiki has on: ${query}`,
        "",
        "## From your sources",
        userBullets,
        ...relatedBlock,
      ].join("\n");

      const plainUser = user
        .slice(0, 5)
        .map((c) => `- From ${c.title ?? "your source"}: ${firstSentences(stripMarkdown(c.text), 1)}`);
      const quickShare = [title, "", ...plainUser].join("\n").trim();

      return { title, bodyMarkdown, citations, quickShare };
    }

    // ── Curated path: safe to summarize our own reviewed content, but only
    // when the best match actually clears the confidence bar (the same bar
    // retrieval itself uses for fallbackUsed) — otherwise this falls through
    // to the graceful "I don't know" below instead of forcing a tangential
    // answer out of weak matches. ──
    if (curated.length > 0 && bestCosine(curated) >= FALLBACK_THRESHOLD) {
      // Rank by cosine (semantic relevance), NOT the RRF finalScore: hybrid
      // fusion over-rewards lexically-dense passages (many keyword repeats),
      // which buries the definitional/most-on-topic section a "what is X"
      // query actually wants.
      const byCosine = [...curated].sort((a, b) => (b.cosine ?? 0) - (a.cosine ?? 0));
      const ranked = dedupeSections(byCosine);

      const embedder = opts.embedder ?? getEmbedder();
      const { bodyMarkdown, quickShare: quickBody } = await composeSentenceAnswer(
        query,
        ranked,
        embedder
      );

      const citations = distinctNodes(curated);
      const quickShare = [title, "", quickBody].join("\n").trim();

      return { title, bodyMarkdown, citations, quickShare };
    }

    // ── Scrape-only path: reference material exists but is unreviewed and must
    // never be reproduced. Surface the matched TOPICS (our taxonomy labels only)
    // and point to the full generator. Never echoes scrape text. Gated on the
    // same confidence bar so a weak scrape match doesn't get surfaced either. ──
    if (scrape.length > 0 && bestCosine(scrape) >= FALLBACK_THRESHOLD) {
      const topics = distinctNodes(scrape);
      const topicLines =
        topics.length > 0
          ? topics.map((t) => `- ${t.title}`).join("\n")
          : "- Related equity-compensation reference material";

      const bodyMarkdown = [
        `Reference material relevant to: ${query}`,
        "",
        "## What this covers",
        "This question is covered by source reference material in the knowledge base. That material is unreviewed and isn't reproduced here — enable the full generator (set `LLM_PROVIDER=groq`) to get a written answer in original wording, grounded in these sources.",
        "",
        "## Related topics in the library",
        topicLines,
      ].join("\n");

      const quickShare = [
        title,
        "",
        "Covered by reference material on: " +
          (topics.map((t) => t.title).join(", ") || "equity compensation") +
          ". Enable the full generator for a complete written answer.",
      ]
        .join("\n")
        .trim();

      return { title, bodyMarkdown, citations: topics, quickShare };
    }

    // ── Nothing retrieved, or nothing cleared the confidence bar: an honest
    // "I don't know" rather than a forced, likely-wrong answer. ──
    return gracefulUnknown(query);
  }
}
