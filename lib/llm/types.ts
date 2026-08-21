import type { RetrievalChunk, Citation } from "@/lib/rag/types";

export type ArtifactResult = {
  title: string;
  bodyMarkdown: string;
  /** Citation.kind/sourceId are optional; topic citations stay `{nodeId,title}`
   *  (byte-identical to before), user citations carry kind + sourceId. */
  citations: Citation[];
  quickShare: string;
};

export type ArtifactFormat = "reference" | "pdf" | "email" | "comparison";

export type GenerateOptions = {
  format?: ArtifactFormat;
  embedder?: import("@/lib/rag/types").Embedder;
};

export interface LLMProvider {
  generate(query: string, chunks: RetrievalChunk[], options?: GenerateOptions): Promise<ArtifactResult>;
}
