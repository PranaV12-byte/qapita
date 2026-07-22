import type { RetrievalChunk, Citation } from "@/lib/rag/types";

export type ArtifactResult = {
  title: string;
  bodyMarkdown: string;
  /** Citation.kind/sourceId are optional; topic citations stay `{nodeId,title}`
   *  (byte-identical to before), user citations carry kind + sourceId. */
  citations: Citation[];
  quickShare: string;
};

export interface LLMProvider {
  generate(query: string, chunks: RetrievalChunk[]): Promise<ArtifactResult>;
}
