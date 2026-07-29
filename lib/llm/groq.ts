import type { ArtifactResult, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk, Citation } from "@/lib/rag/types";
import { SYSTEM_PROMPT, buildUserMessage, rankAndCapChunks } from "@/lib/llm/prompt";
import {
  cleanProseMarkdown,
  cleanProse,
  stripMarkdown,
  gracefulUnknown,
  bestCosine,
  distinctNodes,
  distinctUserSources,
} from "@/lib/llm/mock";
import { FALLBACK_THRESHOLD } from "@/lib/rag/config";
import { z } from "zod";

// nodeId/sourceId both optional (mirrors Citation) — a user-tier citation
// carries sourceId, not nodeId. .nullish() (not just .optional()) because
// models in JSON mode routinely emit an explicit `null` for an omitted field
// rather than leaving it out — .optional() alone rejects that and throws.
const CitationSchema = z
  .object({
    nodeId: z.string().nullish(),
    sourceId: z.string().nullish(),
    title: z.string(),
  })
  .refine((c) => !!c.nodeId || !!c.sourceId, "citation needs nodeId or sourceId");

const ArtifactResultSchema = z.object({
  title: z.string(),
  bodyMarkdown: z.string(),
  citations: z.array(CitationSchema),
  quickShare: z.string(),
});

export class GroqProvider implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[]
  ): Promise<ArtifactResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log("provider_fallback: GROQ_API_KEY missing, falling back to mock");
      const { MockLLM } = await import("@/lib/llm/mock");
      return new MockLLM().generate(query, chunks);
    }

    // Same confidence gate the mock uses: don't hand a real LLM a weak/
    // off-topic retrieval set and hope it polices itself into refusing —
    // retrieval quality, not model behavior, decides whether a question is
    // answerable. Saves an API call too.
    if (chunks.length === 0 || bestCosine(chunks) < FALLBACK_THRESHOLD) {
      return gracefulUnknown(query);
    }

    // The exact chunk set actually sent to the model — citations are
    // validated against this, so the model can never get credit for citing
    // something it was never shown. Titles/labels for the final citations
    // come from OUR OWN metadata (distinctNodes/distinctUserSources), never
    // from the model: it's prone to confusing the chunk tag's `source=`
    // provenance attribute (curated/NASPP/etc.) with a real sourceId, which
    // would otherwise leak a bogus label like {sourceId:"NASPP", title:"NASPP"}
    // into the UI.
    const sentChunks = rankAndCapChunks(chunks);
    const nodeCitationsById = new Map(distinctNodes(sentChunks).map((c) => [c.nodeId, c]));
    const sourceCitationsById = new Map(
      distinctUserSources(sentChunks).map((c) => [c.sourceId!, c])
    );

    const callGroq = async (): Promise<ArtifactResult> => {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserMessage(query, chunks) },
            ],
            temperature: 0,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from Groq");

      const parsed: unknown = JSON.parse(content);
      const result = ArtifactResultSchema.parse(parsed);

      // Never trust the model's citations at face value: resolve identity
      // (does this nodeId/sourceId correspond to a chunk actually sent?) AND
      // label from our own metadata, discarding the model's title/sourceId
      // outright. This is what a bogus model citation like
      // {nodeId:"1.3", sourceId:"NASPP", title:"NASPP"} collapses to: the
      // real {nodeId:"1.3", title:"RSUs & RSAs"} topic citation, deduped.
      const seen = new Set<string>();
      const citations: Citation[] = [];
      for (const c of result.citations) {
        const nodeCite = c.nodeId ? nodeCitationsById.get(c.nodeId) : undefined;
        const sourceCite = c.sourceId ? sourceCitationsById.get(c.sourceId) : undefined;
        const resolved: Citation | undefined = nodeCite ?? sourceCite;
        if (!resolved) continue;
        const key = resolved.sourceId ?? resolved.nodeId ?? resolved.title;
        if (seen.has(key)) continue;
        seen.add(key);
        citations.push(resolved);
      }

      // A prompt instruction ("no em dashes", "complete sentences") is a
      // request, not a guarantee — apply the same deterministic cleanup the
      // mock uses as a backstop regardless of whether the model complied.
      return {
        title: result.title,
        bodyMarkdown: cleanProseMarkdown(result.bodyMarkdown),
        citations,
        // quickShare's contract is plaintext — strip any markdown the model
        // left in despite the prompt, then apply the same tone cleanup.
        quickShare: cleanProse(stripMarkdown(result.quickShare)),
      };
    };

    let attempts = 0;
    while (attempts < 2) {
      try {
        return await callGroq();
      } catch {
        attempts++;
        if (attempts >= 2) {
          console.log(
            "provider_fallback: Groq failed after retry, falling back to mock"
          );
          const { MockLLM } = await import("@/lib/llm/mock");
          return new MockLLM().generate(query, chunks);
        }
      }
    }

    // Unreachable but satisfies TypeScript
    const { MockLLM } = await import("@/lib/llm/mock");
    return new MockLLM().generate(query, chunks);
  }
}
