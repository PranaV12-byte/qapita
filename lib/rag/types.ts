// ── Shared RAG types ──────────────────────────────────────────────────────────
// One home for the data model + the swap-boundary interfaces (Embedder,
// VectorStore, Reranker). Changing an implementation of any interface must never
// require touching a consumer.

export type Tier = "curated" | "scrape";

/** Where a scrape chunk came from (for citation labels). Curated content omits it. */
export type SourceName = "curated" | "myStockOptions" | "NASPP" | (string & {});

/**
 * A stored content chunk (one row of chunks.json, one row of vectors.bin).
 * `text` is ALWAYS the raw chunk text — never the contextual embed-input string,
 * and for scrape tier it is never rendered verbatim to the user (see CLAUDE.md #5/#10).
 */
export type ChunkMeta = {
  tier: Tier;
  /** Real tree node id (e.g. "3.2"), the GENERAL_NODE_ID sentinel, or undefined. */
  nodeId?: string;
  source?: SourceName;
  /** Document title (from filename / _index.md) — used for context + citation. */
  title?: string;
  /** Joined heading trail, e.g. "Taxes > ISO taxation > AMT". */
  headingPath?: string;
  /** Stable id of the parent section, for context expansion at generation time. */
  parentId?: string;
  text: string;
  isScenario?: false;
};

/** A scenario entry (fallback suggestions), embedded alongside content chunks. */
export type ScenarioMeta = {
  tier: "curated";
  isScenario: true;
  scenarioId: string;
  label: string;
  text: string;
};

export type IndexEntry = ChunkMeta | ScenarioMeta;

/** A parent section, keyed by parentId in parents.json. Fed to the LLM as context. */
export type ParentSection = {
  parentId: string;
  nodeId?: string;
  title?: string;
  headingPath?: string;
  text: string;
};

/** A chunk returned from retrieval, enriched with scores and parent context. */
export type RetrievalChunk = ChunkMeta & {
  score: number;
  cosine: number;
  /** Parent-section text for generation context (may equal `text` if no parent). */
  parentText?: string;
};

export type RetrievalResult = {
  chunks: RetrievalChunk[];
  fallbackUsed: boolean;
  fallbackScenario?: { id: string; label: string };
};

// ── Swap-boundary interfaces ────────────────────────────────────────────────────

/**
 * bge and most retrieval models are asymmetric: queries get an instruction prefix,
 * passages do not. Callers must pick the right method — never embed a query as a
 * passage or vice versa.
 */
export interface Embedder {
  readonly id: string;
  readonly dim: number;
  embedQuery(text: string): Promise<Float32Array>;
  embedPassage(text: string): Promise<Float32Array>;
  embedPassages(texts: string[]): Promise<Float32Array[]>;
}

/** Cross-encoder reranker. Returns a relevance score per doc, aligned to `docs`. */
export interface Reranker {
  readonly id: string;
  rerank(query: string, docs: string[]): Promise<number[]>;
}

/** Nearest-neighbour search over the embedded corpus. Brute-force now, ANN later. */
export interface VectorStore {
  readonly size: number;
  readonly dim: number;
  /**
   * Top-k by cosine, descending. `filter(i)` (if given) restricts the candidate
   * set to rows where it returns true — used for hard node/pillar pre-filtering.
   */
  search(
    query: Float32Array,
    k: number,
    filter?: (index: number) => boolean
  ): { index: number; cosine: number }[];
  /** Raw vector for row i (for dedup comparisons). */
  row(index: number): Float32Array;
}
