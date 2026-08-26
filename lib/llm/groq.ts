import type { ArtifactResult, GenerateOptions, LLMProvider } from "./types";
import type { RetrievalChunk, Citation } from "../rag/types";
import { randomUUID } from "node:crypto";
import { SYSTEM_PROMPT, buildUserMessage, rankAndCapChunks } from "./prompt";
import {
  cleanProseMarkdown,
  cleanProse,
  stripMarkdown,
  gracefulUnknown,
  bestCosine,
  distinctNodes,
  distinctUserSources,
} from "./mock";
import { FALLBACK_THRESHOLD } from "../rag/config";
import { hasGroundedEvidence } from "../rag/relevance";
import { z } from "zod";
import { normalizeArtifactTitle } from "./title";

// nodeId/sourceId both optional (mirrors Citation)  -  a user-tier citation
// carries sourceId, not nodeId. .nullish() (not just .optional()) because
// models in JSON mode routinely emit an explicit `null` for an omitted field
// rather than leaving it out  -  .optional() alone rejects that and throws.
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

const ArtifactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bodyMarkdown", "citations", "quickShare"],
  properties: {
    title: { type: "string" },
    bodyMarkdown: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nodeId", "sourceId", "title"],
        properties: {
          nodeId: { type: ["string", "null"] },
          sourceId: { type: ["string", "null"] },
          title: { type: "string" },
        },
        anyOf: [
          { required: ["nodeId"], properties: { nodeId: { type: "string" } } },
          { required: ["sourceId"], properties: { sourceId: { type: "string" } } },
        ],
      },
    },
    quickShare: { type: "string" },
  },
} as const;

export class GroqProvider implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[],
    options: GenerateOptions = {}
  ): Promise<ArtifactResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log("provider_fallback: GROQ_API_KEY missing, falling back to mock");
      const { MockLLM } = await import("./mock");
      return new MockLLM().generate(query, chunks, options);
    }

    // Same confidence gate the mock uses: don't hand a real LLM a weak/
    // off-topic retrieval set and hope it polices itself into refusing.
    // retrieval quality, not model behavior, decides whether a question is
    // answerable. Saves an API call too.
    if (
      chunks.length === 0 ||
      (bestCosine(chunks) < FALLBACK_THRESHOLD && !hasGroundedEvidence(query, chunks))
    ) {
      return gracefulUnknown(query);
    }

    // The exact chunk set actually sent to the model  -  citations are
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
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 15_000);
      const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserMessage(query, sentChunks, options.format) },
            ],
            temperature: 0,
            max_tokens: 2000,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "artifact_result",
                strict: true,
                schema: ArtifactJsonSchema,
              },
            },
          }),
          signal: timeout.signal,
        }
      ).finally(() => clearTimeout(timer));

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
      // request, not a guarantee. Apply the same deterministic cleanup the
      // mock uses as a backstop regardless of whether the model complied.
      return {
        title: normalizeArtifactTitle(result.title, query),
        bodyMarkdown: cleanProseMarkdown(result.bodyMarkdown),
        citations,
        // quickShare's contract is plaintext. Strip any markdown the model
        // left in despite the prompt, then apply the same tone cleanup.
        quickShare: cleanProse(stripMarkdown(result.quickShare)),
      };
    };

    const startedAt = Date.now();
    try {
      return await callGroq();
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error && error.message.startsWith("Groq API error:")
          ? error.message.replace("Groq API error: ", "http_")
          : error instanceof SyntaxError
            ? "invalid_json"
            : "provider_or_schema_error";
      console.log(JSON.stringify({
        event: "provider_fallback",
        provider: "groq",
        requestId: randomUUID(),
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
        reason,
        durationMs: Date.now() - startedAt,
      }));
      try {
        const { MockLLM } = await import("./mock");
        return await new MockLLM().generate(query, chunks, options);
      } catch (fallbackError) {
        console.error("Mock provider fallback failed", fallbackError);
        return gracefulUnknown(query);
      }
    }
  }
}
