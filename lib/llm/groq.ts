import type { ArtifactResult, ComparisonData, GenerateOptions, LLMProvider } from "./types";
import type { RetrievalChunk, Citation } from "../rag/types";
import { randomUUID } from "node:crypto";
import { SYSTEM_PROMPT, buildUserMessage, rankAndCapChunks } from "./prompt";
import {
  cleanProseMarkdown,
  cleanProse,
  stripMarkdown,
  gracefulUnknown,
  gracefulComparisonRefinement,
  bestCosine,
  distinctNodes,
  distinctUserSources,
} from "./mock";
import {
  ComparisonDataSchema,
  comparisonToMarkdown,
  comparisonToQuickShare,
  wantsStructuredComparison,
} from "./comparison";
import { normalizeGeneratedText } from "./output-normalizer";
import { FALLBACK_THRESHOLD } from "../rag/config";
import { hasGroundedEvidence } from "../rag/relevance";
import { z } from "zod";
import { normalizeArtifactTitle } from "./title";

const ArtifactResultSchema = z.object({
  title: z.string(),
  bodyMarkdown: z.string(),
  quickShare: z.string(),
  comparison: ComparisonDataSchema.optional(),
});

const ArtifactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bodyMarkdown", "quickShare"],
  properties: {
    title: { type: "string" },
    bodyMarkdown: { type: "string" },
    quickShare: { type: "string" },
  },
} as const;

const ComparisonArtifactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bodyMarkdown", "quickShare", "comparison"],
  properties: {
    ...ArtifactJsonSchema.properties,
    comparison: {
      type: "object",
      additionalProperties: false,
      required: ["title", "subtitle", "columns", "rows", "takeaway"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 160 },
        subtitle: { type: "string", minLength: 1, maxLength: 260 },
        columns: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 100 } },
        rows: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["feature", "values"],
            properties: {
              feature: { type: "string", minLength: 1, maxLength: 100 },
              values: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 420 } },
            },
          },
        },
        takeaway: { type: "string", minLength: 1, maxLength: 600 },
      },
    },
  },
} as const;

function normalizeComparison(data: ComparisonData): ComparisonData {
  return {
    title: normalizeGeneratedText(data.title),
    subtitle: normalizeGeneratedText(data.subtitle),
    columns: data.columns.map((column) => normalizeGeneratedText(column)),
    rows: data.rows.map((row) => ({
      feature: normalizeGeneratedText(row.feature),
      values: row.values.map((value) => normalizeGeneratedText(value)),
    })),
    takeaway: normalizeGeneratedText(data.takeaway),
  };
}

export class GroqProvider implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[],
    options: GenerateOptions = {}
  ): Promise<ArtifactResult> {
    const comparisonRequested = wantsStructuredComparison(query, options.format);
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
      return comparisonRequested ? gracefulComparisonRefinement(query) : gracefulUnknown(query);
    }

    // The model receives only the exact grounded chunk set it is allowed to
    // use, with opaque indexes instead of internal IDs. Citation identity is
    // resolved by the server from trusted grounding metadata.
    const sentChunks = rankAndCapChunks(chunks);

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
              { role: "user", content: buildUserMessage(query, sentChunks, options.format, options.queryIntent, options.evidenceProfile) },
            ],
            temperature: 0,
            // There is no editorial word ceiling. This is only the provider's
            // response allowance; deterministic composition remains the
            // deploy-safe fallback when a provider cannot satisfy the request.
            max_tokens: comparisonRequested ? 3500 : 12000,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: comparisonRequested ? "comparison_artifact_result" : "artifact_result",
                strict: true,
                schema: comparisonRequested ? ComparisonArtifactJsonSchema : ArtifactJsonSchema,
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
      if (comparisonRequested && !result.comparison) {
        throw new Error("comparison_schema_missing");
      }

      const citations: Citation[] = [...distinctNodes(sentChunks), ...distinctUserSources(sentChunks)];

      // A prompt instruction ("no em dashes", "complete sentences") is a
      // request, not a guarantee. Apply the same deterministic cleanup the
      // mock uses as a backstop regardless of whether the model complied.
      if (comparisonRequested && result.comparison) {
        const normalized = normalizeComparison(result.comparison);
        const validated = ComparisonDataSchema.parse(normalized);
        const comparisonTitle = normalizeArtifactTitle(validated.title, query);
        const comparison = { ...validated, title: comparisonTitle };
        return {
          title: comparisonTitle,
          bodyMarkdown: comparisonToMarkdown(comparison),
          citations,
          quickShare: comparisonToQuickShare(comparison),
          comparison,
        };
      }

      const bodyMarkdown = cleanProseMarkdown(result.bodyMarkdown);
      return {
        title: normalizeArtifactTitle(result.title, query),
        bodyMarkdown,
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
      } catch {
        console.error("Mock provider fallback failed");
        return comparisonRequested ? gracefulComparisonRefinement(query) : gracefulUnknown(query);
      }
    }
  }
}
