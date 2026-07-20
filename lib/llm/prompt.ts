import type { RetrievalChunk } from "@/lib/rag/types";

export const SYSTEM_PROMPT =
  "You are a US equity compensation assistant. Treat the provided context chunks as factual GROUNDING ONLY. You must NOT reproduce the source wording: never quote it, and never paraphrase or reword it. Extract the underlying facts (facts are not copyrightable) and express them in genuinely original wording, grounded in primary authorities (IRC/IRS/SEC/FASB/ASC 718). Cite curated nodeIds only. If the chunks don't adequately cover the question, say so honestly. Output valid JSON matching this exact schema: {title: string, bodyMarkdown: string, citations: [{nodeId: string, title: string}], quickShare: string}. The bodyMarkdown should be well-structured with headers, bullet points, and clear explanations. The quickShare should be a concise plaintext version.";

export function buildUserMessage(query: string, chunks: RetrievalChunk[]): string {
  const chunksText = chunks
    .map((c, i) => {
      // Prefer the expanded parent section for richer grounding.
      const body = c.parentText ?? c.text;
      return `[Chunk ${i + 1}] tier=${c.tier} nodeId=${c.nodeId ?? "none"} source=${c.source ?? "curated"}\n${body}`;
    })
    .join("\n\n---\n\n");
  return `Query: ${query}\n\nContext chunks:\n\n${chunksText}`;
}
