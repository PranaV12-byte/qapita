import type { RetrievalChunk } from "@/lib/rag/types";

export type ArtifactResult = {
  title: string;
  bodyMarkdown: string;
  citations: { nodeId: string; title: string }[];
  quickShare: string;
};

export interface LLMProvider {
  generate(query: string, chunks: RetrievalChunk[]): Promise<ArtifactResult>;
}
