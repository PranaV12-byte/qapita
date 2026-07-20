// ── RAG configuration ─────────────────────────────────────────────────────────
// Every tunable lives here and is env-overridable. The six documented retrieval
// constants keep their CLAUDE.md values; everything else is additive.

function num(raw: string | undefined, def: number): number {
  if (raw === undefined) return def;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : def;
}

function bool(raw: string | undefined, def: boolean): boolean {
  if (raw === undefined) return def;
  return raw === "true" || raw === "1";
}

// Documented constants (CLAUDE.md) — unchanged defaults.
export const CURATED_WEIGHT = num(process.env.CURATED_WEIGHT, 1.0);
export const SCRAPE_WEIGHT = num(process.env.SCRAPE_WEIGHT, 0.7);
export const NODE_BOOST = num(process.env.NODE_BOOST, 1.5);
export const TOP_K = num(process.env.TOP_K, 8);
export const SCRAPE_CAP = num(process.env.SCRAPE_CAP, 3);
export const FALLBACK_THRESHOLD = num(
  process.env.RETRIEVAL_FALLBACK_THRESHOLD,
  0.35
);

// New constants for the hybrid + rerank pipeline.
export const RRF_K = num(process.env.RRF_K, 60);
export const DEDUP_COSINE_THRESHOLD = num(
  process.env.DEDUP_COSINE_THRESHOLD,
  0.93
);
export const RERANK_POOL_SIZE = num(process.env.RERANK_POOL_SIZE, 40);
// Off by default: the cross-encoder weights aren't present in the offline dev
// box. Set RERANK_ENABLED=true once ms-marco-MiniLM-L-6-v2 is available locally.
export const RERANK_ENABLED = bool(process.env.RERANK_ENABLED, false);
export const EMBEDDING_DIM = num(process.env.EMBEDDING_DIM, 384);
// Allow transformers.js to fetch models from the HF hub. Default false so an
// offline machine fails fast against the local cache instead of hanging on a
// blocked socket. Set true on a networked machine to download bge/rerankers once.
export const ALLOW_REMOTE_MODELS = bool(process.env.ALLOW_REMOTE_MODELS, false);

// Classification.
/** Below this cosine to every node → off-topic (excluded). */
export const CLASSIFY_MIN_CONFIDENCE = num(
  process.env.CLASSIFY_MIN_CONFIDENCE,
  0.3
);
/** At/above this cosine to the best node → assign that specific node; between the
 *  two thresholds → the `general` bucket. */
export const CLASSIFY_NODE_CONFIDENCE = num(
  process.env.CLASSIFY_NODE_CONFIDENCE,
  0.45
);
/** Scrape-only catch-all bucket. NOT a member of the curated PILLARS/ALL_NODES tree. */
export const GENERAL_NODE_ID = "general";
export const GENERAL_NODE_TITLE = "General equity compensation";

// Models (local via @xenova/transformers).
// Default = all-MiniLM-L6-v2 (384-dim), which is cached locally and runs offline.
// To upgrade to bge-base once its weights are on disk, set:
//   EMBEDDER_MODEL=Xenova/bge-base-en-v1.5
//   EMBEDDING_DIM=768
//   EMBED_QUERY_PREFIX="Represent this sentence for searching relevant passages: "
//   RERANK_ENABLED=true
export const EMBEDDER_MODEL =
  process.env.EMBEDDER_MODEL ?? "Xenova/all-MiniLM-L6-v2";
export const RERANKER_MODEL =
  process.env.RERANKER_MODEL ?? "Xenova/ms-marco-MiniLM-L-6-v2";
/** Query instruction prefix (asymmetric models only). Empty for MiniLM. */
export const QUERY_PREFIX = process.env.EMBED_QUERY_PREFIX ?? "";

// Optional LLM contextual enrichment at ingest (off for the demo).
export const CONTEXTUAL_ENRICHMENT = bool(
  process.env.CONTEXTUAL_ENRICHMENT,
  false
);

// Chunking.
export const CHUNK_MAX_CHARS = num(process.env.CHUNK_MAX_CHARS, 500);
export const CHUNK_OVERLAP = num(process.env.CHUNK_OVERLAP, 80);
