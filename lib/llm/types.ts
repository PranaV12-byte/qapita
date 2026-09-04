import type { RetrievalChunk, Citation } from "@/lib/rag/types";
import type { QueryIntent } from "./query-intent";
import type { EvidenceProfile } from "./answer-composer";

export type ComparisonRow = {
  feature: string;
  values: string[];
};

export type ComparisonData = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: ComparisonRow[];
  takeaway: string;
};

export type ArtifactResult = {
  title: string;
  bodyMarkdown: string;
  /** Citation.kind/sourceId are optional; topic citations stay `{nodeId,title}`
   *  (byte-identical to before), user citations carry kind + sourceId. */
  citations: Citation[];
  quickShare: string;
  /** Present for structured comparison results. Optional for old artifacts. */
  comparison?: ComparisonData;
};

export type ArtifactFormat = "reference" | "pdf" | "email" | "comparison";

export type GenerateOptions = {
  format?: ArtifactFormat;
  embedder?: import("@/lib/rag/types").Embedder;
  /** Internal intent metadata used to keep definition answers on-topic. */
  queryIntent?: QueryIntent;
  /** Reviewed evidence used only to calibrate generated-answer depth. */
  evidenceProfile?: EvidenceProfile;
};

export interface LLMProvider {
  generate(query: string, chunks: RetrievalChunk[], options?: GenerateOptions): Promise<ArtifactResult>;
}
