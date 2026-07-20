import type { ArtifactResult, LLMProvider } from "@/lib/llm/types";
import type { RetrievalChunk } from "@/lib/rag/types";
import { MockLLM } from "@/lib/llm/mock";

export class AnthropicProvider implements LLMProvider {
  async generate(
    query: string,
    chunks: RetrievalChunk[]
  ): Promise<ArtifactResult> {
    console.log("Anthropic provider not yet configured.");
    return new MockLLM().generate(query, chunks);
  }
}
