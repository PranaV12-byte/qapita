import type { ArtifactResult, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk } from "@/lib/rag/types";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/llm/prompt";
import { z } from "zod";

const ArtifactResultSchema = z.object({
  title: z.string(),
  bodyMarkdown: z.string(),
  citations: z.array(z.object({ nodeId: z.string(), title: z.string() })),
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
            temperature: 0.3,
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
      return ArtifactResultSchema.parse(parsed);
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
