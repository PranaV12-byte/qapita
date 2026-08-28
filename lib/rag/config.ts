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
/**
 * The deploy-safe default does not require a model download. Set
 * EMBEDDER_MODE=transformers only in an environment with the model weights.
 */
export const EMBEDDER_MODE = process.env.EMBEDDER_MODE ?? "hash";
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

// Models (local via Transformers.js).
// Default = all-MiniLM-L6-v2 (384-dim), which is cached locally and runs offline.
// To upgrade to bge-base once its weights are on disk, set:
//   EMBEDDER_MODEL=Xenova/bge-base-en-v1.5
//   EMBEDDING_DIM=768
//   EMBED_QUERY_PREFIX="Represent this sentence for searching relevant passages: "
//   RERANK_ENABLED=true
export const EMBEDDER_MODEL =
  process.env.EMBEDDER_MODEL ??
  (EMBEDDER_MODE === "transformers"
    ? "Xenova/all-MiniLM-L6-v2"
    : "equityiq-deterministic-hash-v1");
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

// Private Brain settings: uploaded-content weighting, graph-aware neighbour
// expansion, ingestion caps, and lint cadence. They are additive; the
// foundation-only application path does not read them without a Brain.
/** Tier weight for user-uploaded content in retrieval scoring. */
export const USER_WEIGHT = num(process.env.USER_WEIGHT, 1.0);
/** Master switch for post-selection neighbour expansion in retrieveMulti. */
export const GRAPH_EXPANSION = bool(process.env.GRAPH_EXPANSION, true);
/** Max extra passages pulled in from graph neighbours of top hits. */
export const NEIGHBOR_LIMIT = num(process.env.NEIGHBOR_LIMIT, 4);
/** Minimum cosine for a neighbour candidate to be included. */
export const NEIGHBOR_MIN_COSINE = num(process.env.NEIGHBOR_MIN_COSINE, 0.25);
/** Per-file upload cap (megabytes) before extraction is attempted. */
export const BRAIN_MAX_FILE_MB = num(process.env.BRAIN_MAX_FILE_MB, 4);
/** Per-file extracted-text cap (megabytes) after extraction. */
export const BRAIN_MAX_TEXT_MB = num(process.env.BRAIN_MAX_TEXT_MB, 1.5);
/** Soft cap on total passages per brain; surfaced in the UI, never silent. */
export const BRAIN_MAX_PASSAGES = num(process.env.BRAIN_MAX_PASSAGES, 5000);
/** Max files accepted in a single upload batch. */
export const BRAIN_BATCH_LIMIT = num(process.env.BRAIN_BATCH_LIMIT, 10);
/** Auto-trigger a lint pass after this many appends since the last one. */
export const LINT_APPEND_THRESHOLD = num(process.env.LINT_APPEND_THRESHOLD, 5);
/** Auto-trigger a lint pass if the last one is older than this many days. */
export const LINT_STALE_DAYS = num(process.env.LINT_STALE_DAYS, 7);
/** Max number of loaded brain deltas kept warm in the in-process LRU. */
export const BRAIN_LRU = num(process.env.BRAIN_LRU, 50);
