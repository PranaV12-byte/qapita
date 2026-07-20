import type { ArtifactResult, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk } from "@/lib/rag/types";
import { getNode } from "@/lib/content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE } from "@/lib/rag/config";

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .trim();
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
  return result || normalized.slice(0, 200).trim();
}

/** Display label for a chunk's node — our own taxonomy label, never source text. */
function nodeLabel(nodeId?: string): string | null {
  if (!nodeId) return null;
  if (nodeId === GENERAL_NODE_ID) return GENERAL_NODE_TITLE;
  return getNode(nodeId)?.title ?? null;
}

/** Distinct {nodeId, title} for a set of chunks, preserving order. */
function distinctNodes(chunks: RetrievalChunk[]): { nodeId: string; title: string }[] {
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

export class MockLLM implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[]
  ): Promise<ArtifactResult> {
    if (process.env.MOCK_DELAY !== "false") {
      const delay = 1200 + (Math.random() * 600 - 300);
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    const title = `Reference: ${query.slice(0, 80)}`;
    const curated = chunks.filter((c) => c.tier === "curated");
    const scrape = chunks.filter((c) => c.tier === "scrape");

    // ── Curated path: safe to summarize our own reviewed content. ──
    if (curated.length > 0) {
      const coverBullets = curated
        .slice(0, 5)
        .map((c) => `- ${firstSentences(c.text, 1)}`)
        .join("\n");
      const keyLines = curated
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${firstSentences(c.text, 2)}`);

      const citations = distinctNodes(curated);
      const citedTopics =
        citations.length > 0
          ? citations.map((ct) => `- ${ct.title}`).join("\n")
          : "- No cited topics";

      const bodyMarkdown = [
        `Here's a working reference for: ${query}`,
        "",
        "## What this covers",
        coverBullets,
        "",
        "## Key points",
        keyLines.join("\n"),
        "",
        "## Cited topics",
        citedTopics,
      ].join("\n");

      const plainKeyLines = curated
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${firstSentences(stripMarkdown(c.text), 2)}`);
      const quickShare = [title, "", ...plainKeyLines].join("\n").trim();

      return { title, bodyMarkdown, citations, quickShare };
    }

    // ── Scrape-only path: reference material exists but is unreviewed and must
    // never be reproduced. Surface the matched TOPICS (our taxonomy labels only)
    // and point to the full generator. Never echoes scrape text. ──
    if (scrape.length > 0) {
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

    // ── Nothing retrieved (usually paired with the fallback notice). ──
    const bodyMarkdown = [
      `Here's a working reference for: ${query}`,
      "",
      "## What this covers",
      "- No matching content found in the knowledge base.",
    ].join("\n");
    return { title, bodyMarkdown, citations: [], quickShare: title };
  }
}
