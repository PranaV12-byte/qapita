import fs from "node:fs";
import path from "node:path";
import type MiniSearch from "minisearch";
import { cosineSimilarity } from "./cosine";
import { FlatVectorStore } from "./vectorStore";
import {
  buildLexicalIndex,
  loadLexicalIndex,
  lexicalSearch,
  rrfFuse,
} from "./lexical";
import { selectResults, type Candidate } from "./select";
import { computeFallback, type ScenarioVector } from "./fallback";
import { getEmbedder } from "./embedder";
import { getReranker } from "./rerank";
import { hasGroundedEvidence, relevanceTokens } from "./relevance";
import { getNode, ALL_NODES } from "@/lib/content/tree";
import type {
  ChunkMeta,
  Embedder,
  IndexEntry,
  ParentSection,
  Reranker,
  RetrievalChunk,
  RetrievalResult,
  VectorStore,
} from "./types";
import {
  CURATED_WEIGHT,
  SCRAPE_WEIGHT,
  USER_WEIGHT,
  NODE_BOOST,
  TOP_K,
  SCRAPE_CAP,
  FALLBACK_THRESHOLD,
  RERANK_POOL_SIZE,
  DEDUP_COSINE_THRESHOLD,
  EMBEDDING_DIM,
  EMBEDDER_MODE,
  GRAPH_EXPANSION,
  NEIGHBOR_LIMIT,
  NEIGHBOR_MIN_COSINE,
} from "./config";

const DATA_DIR = path.join(process.cwd(), "data");

export type Stores = {
  entries: IndexEntry[];
  store: VectorStore;
  lexical: MiniSearch;
  parents: Record<string, ParentSection>;
  scenarioVecs: ScenarioVector[];
};

export type RetrieveOpts = {
  /** Soft boost target: chunks on this node are multiplied by NODE_BOOST. */
  nodeId?: string;
  /** Hard pre-filter: restrict candidates to exactly this node. */
  filterToNode?: string;
  /** Hard pre-filter: restrict candidates to this pillar slug. */
  pillar?: string;
  /** Inject an embedder (tests use a deterministic fake). Defaults to the real one. */
  embedder?: Embedder;
  /** Inject a reranker (tests use a deterministic stub). Defaults to the real one. */
  reranker?: Reranker;
  /** Override the rerank on/off switch (default: RERANK_ENABLED). */
  rerank?: boolean;
  poolSize?: number;
  topK?: number;
  scrapeCap?: number;
  /** retrieveMulti only: override GRAPH_EXPANSION for neighbour expansion. */
  graphExpansion?: boolean;
  /** retrieveMulti only: override NEIGHBOR_LIMIT. */
  neighborLimit?: number;
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function tierWeight(tier: ChunkMeta["tier"]): number {
  if (tier === "scrape") return SCRAPE_WEIGHT;
  if (tier === "user") return USER_WEIGHT;
  return CURATED_WEIGHT;
}

/** Load all retrieval stores from a data directory. */
export function loadStores(dir: string): Stores {
  const vecPath = path.join(dir, "vectors.bin");
  const chunkPath = path.join(dir, "chunks.json");
  if (!fs.existsSync(vecPath) || !fs.existsSync(chunkPath)) {
    throw new Error("Index not built. Run `npm run build:index` first.");
  }

  const buf = fs.readFileSync(vecPath);
  const vectors = new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
  const entries = JSON.parse(fs.readFileSync(chunkPath, "utf-8")) as IndexEntry[];

  const manifestPath = path.join(dir, "index-manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      embedderId?: string;
      dimensions?: number;
      entryCount?: number;
    };
    if (manifest.dimensions !== EMBEDDING_DIM || manifest.entryCount !== entries.length || manifest.embedderId !== getEmbedder().id) {
      throw new Error("Retrieval index manifest does not match the runtime configuration.");
    }
  }

  const dim =
    entries.length > 0
      ? Math.round(vectors.length / entries.length)
      : EMBEDDING_DIM;
  if (dim !== EMBEDDING_DIM || vectors.length !== entries.length * dim) {
    throw new Error("Retrieval vectors do not match the configured embedding dimension.");
  }
  const store = new FlatVectorStore(vectors, dim);

  const parentsPath = path.join(dir, "parents.json");
  const parents: Record<string, ParentSection> = fs.existsSync(parentsPath)
    ? JSON.parse(fs.readFileSync(parentsPath, "utf-8"))
    : {};

  const lexPath = path.join(dir, "lexical-index.json");
  const lexical = fs.existsSync(lexPath)
    ? loadLexicalIndex(fs.readFileSync(lexPath, "utf-8"))
    : buildLexicalIndex(entries);

  const scenarioVecs: ScenarioVector[] = [];
  entries.forEach((e, i) => {
    if (e.isScenario) {
      scenarioVecs.push({
        scenarioId: e.scenarioId,
        label: e.label,
        vector: store.row(i),
      });
    }
  });

  return { entries, store, lexical, parents, scenarioVecs };
}

// ── Multi-store view ──────────────────────────────────────────────────────────────
// The retrieval pipeline runs over one or more Stores addressed in a single
// GLOBAL index space: store 0 occupies [0, n0), store 1 [n0, n0+n1), etc.
// retrieveWith passes one store (offset 0 — byte-identical to the old
// single-store path); retrieveMulti passes [foundation, brainDelta].

type OffsetView = {
  base: number;
  count: number;
  entries: IndexEntry[];
  store: VectorStore;
  lexical: MiniSearch;
  parents: Record<string, ParentSection>;
  scenarioVecs: ScenarioVector[];
};

function buildViews(storesList: Stores[]): OffsetView[] {
  const views: OffsetView[] = [];
  let base = 0;
  for (const s of storesList) {
    views.push({
      base,
      count: s.entries.length,
      entries: s.entries,
      store: s.store,
      lexical: s.lexical,
      parents: s.parents,
      scenarioVecs: s.scenarioVecs,
    });
    base += s.entries.length;
  }
  return views;
}

function locate(views: OffsetView[], global: number): { view: OffsetView; local: number } {
  for (const v of views) {
    if (global >= v.base && global < v.base + v.count) {
      return { view: v, local: global - v.base };
    }
  }
  throw new Error(`global index ${global} out of range`);
}

const entryAt = (views: OffsetView[], g: number): IndexEntry => {
  const { view, local } = locate(views, g);
  return view.entries[local];
};
const rowAt = (views: OffsetView[], g: number): Float32Array => {
  const { view, local } = locate(views, g);
  return view.store.row(local);
};
const parentAt = (views: OffsetView[], g: number): ParentSection | undefined => {
  const { view, local } = locate(views, g);
  const entry = view.entries[local] as ChunkMeta;
  return entry.parentId ? view.parents[entry.parentId] : undefined;
};

/** Dense recall across all views, merged into the global index space and
 *  re-sorted. For a single view (offset 0) this is identical to the store's
 *  own top-k. */
function multiDense(
  views: OffsetView[],
  queryVec: Float32Array,
  k: number,
  filter: (g: number) => boolean
): { index: number; cosine: number }[] {
  const all: { index: number; cosine: number }[] = [];
  for (const v of views) {
    const hits = v.store.search(queryVec, k, (local) => filter(v.base + local));
    for (const h of hits) all.push({ index: v.base + h.index, cosine: h.cosine });
  }
  all.sort((a, b) => b.cosine - a.cosine);
  return all.slice(0, k);
}

function multiLexical(
  views: OffsetView[],
  query: string,
  k: number,
  filter: (g: number) => boolean
): { index: number; score: number }[] {
  const all: { index: number; score: number }[] = [];
  for (const v of views) {
    const hits = lexicalSearch(v.lexical, query, k);
    for (const h of hits) {
      const g = v.base + h.index;
      if (filter(g)) all.push({ index: g, score: h.score });
    }
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, k);
}

/** The shared scoring/selection/fallback pipeline, over global indices. Both
 *  retrieveWith and retrieveMulti build views and call this — the single home
 *  for RRF fusion, tier weighting, node boost, rerank, greedy select, parent
 *  expansion, and the scenario fallback. */
async function assemble(
  query: string,
  queryVec: Float32Array,
  views: OffsetView[],
  opts: RetrieveOpts
): Promise<{ result: RetrievalResult; selectedIdx: number[] }> {
  const nodeId = opts.nodeId;
  const poolSize = opts.poolSize ?? RERANK_POOL_SIZE;
  const topK = opts.topK ?? TOP_K;
  const scrapeCap = opts.scrapeCap ?? SCRAPE_CAP;
  const rerankOn = opts.rerank ?? process.env.RERANK_ENABLED === "true";

  const notScenario = (g: number) => !entryAt(views, g).isScenario;
  let filter: (g: number) => boolean = notScenario;
  if (opts.filterToNode) {
    const target = opts.filterToNode;
    filter = (g) => notScenario(g) && (entryAt(views, g) as ChunkMeta).nodeId === target;
  } else if (opts.pillar) {
    const target = opts.pillar;
    filter = (g) => {
      if (!notScenario(g)) return false;
      const id = (entryAt(views, g) as ChunkMeta).nodeId;
      return !!id && getNode(id)?.pillarSlug === target;
    };
  }

  const denseHits = multiDense(views, queryVec, poolSize, filter);
  const lexicalQuery = relevanceTokens(query).join(" ") || query;
  const lexHits = multiLexical(views, lexicalQuery, poolSize, filter);

  const fused = rrfFuse([
    denseHits.map((h) => h.index),
    lexHits.map((h) => h.index),
  ]);

  type Scored = { index: number; entry: ChunkMeta; cosine: number; finalScore: number };
  const pool: Scored[] = [...fused.keys()].map((index) => {
    const entry = entryAt(views, index) as ChunkMeta;
    const cosine = cosineSimilarity(queryVec, rowAt(views, index));
    const tierW = tierWeight(entry.tier);
    const boost = nodeId && entry.nodeId === nodeId ? NODE_BOOST : 1;
    return { index, entry, cosine, finalScore: fused.get(index)! * tierW * boost };
  });

  if (rerankOn && pool.length > 0) {
    const reranker = opts.reranker ?? getReranker();
    const scores = await reranker.rerank(query, pool.map((c) => c.entry.text));
    pool.forEach((c, i) => {
      const tierW = tierWeight(c.entry.tier);
      const boost = nodeId && c.entry.nodeId === nodeId ? NODE_BOOST : 1;
      c.finalScore = sigmoid(scores[i] ?? 0) * tierW * boost;
    });
  }

  pool.sort((a, b) => b.finalScore - a.finalScore);

  const selected = selectResults(
    pool.map<Candidate>((c) => ({
      index: c.index,
      tier: c.entry.tier,
      score: c.finalScore,
      cosine: c.cosine,
    })),
    {
      topK,
      scrapeCap,
      dedupThreshold: DEDUP_COSINE_THRESHOLD,
      getVector: (i) => rowAt(views, i),
    }
  );

  const chunks: RetrievalChunk[] = selected.map((s) => {
    const entry = entryAt(views, s.index) as ChunkMeta;
    const parent = parentAt(views, s.index);
    return {
      ...entry,
      score: s.score,
      cosine: s.cosine,
      parentText: parent?.text ?? entry.text,
    };
  });

  const bestHit = multiDense(views, queryVec, 1, notScenario);
  const bestContentCosine = bestHit.length > 0 ? bestHit[0].cosine : 0;
  const scenarioVecs = views.flatMap((v) => v.scenarioVecs);
  const evidenceBacked = hasGroundedEvidence(query, chunks);
  const confidenceCosine = EMBEDDER_MODE === "hash" && evidenceBacked
    ? Math.max(bestContentCosine, FALLBACK_THRESHOLD)
    : bestContentCosine;
  const { fallbackUsed, fallbackScenario } = computeFallback(
    queryVec,
    scenarioVecs,
    confidenceCosine,
    chunks.length,
    FALLBACK_THRESHOLD
  );

  return {
    result: { chunks, fallbackUsed, fallbackScenario },
    selectedIdx: selected.map((s) => s.index),
  };
}

/** Graph neighbour expansion (retrieveMulti only). Pulls a bounded set of
 *  extra passages adjacent to the top hits — same node, same pillar (our
 *  dependency-free stand-in for "related" topics), or same uploaded source —
 *  so an answer sees the local neighbourhood, not isolated snippets. */
function expandNeighbours(
  chunks: RetrievalChunk[],
  selectedIdx: number[],
  views: OffsetView[],
  queryVec: Float32Array,
  limit: number
): RetrievalChunk[] {
  if (limit <= 0 || selectedIdx.length === 0) return chunks;

  const selectedSet = new Set(selectedIdx);
  const selectedNodes = new Set<string>();
  const selectedSources = new Set<string>();
  for (const g of selectedIdx) {
    const e = entryAt(views, g) as ChunkMeta;
    if (e.nodeId) selectedNodes.add(e.nodeId);
    if (e.sourceId) selectedSources.add(e.sourceId);
  }

  const neighbourNodes = new Set<string>(selectedNodes);
  for (const nodeId of selectedNodes) {
    const node = getNode(nodeId);
    if (node) {
      for (const sib of ALL_NODES) {
        if (sib.pillarSlug === node.pillarSlug) neighbourNodes.add(sib.id);
      }
    }
  }

  const filter = (g: number): boolean => {
    if (selectedSet.has(g)) return false;
    const e = entryAt(views, g);
    if (e.isScenario) return false;
    const cm = e as ChunkMeta;
    return (
      (!!cm.nodeId && neighbourNodes.has(cm.nodeId)) ||
      (!!cm.sourceId && selectedSources.has(cm.sourceId))
    );
  };

  const hits = multiDense(views, queryVec, limit + selectedIdx.length, filter)
    .filter((h) => h.cosine >= NEIGHBOR_MIN_COSINE)
    .slice(0, limit);

  const extra: RetrievalChunk[] = hits.map((h) => {
    const entry = entryAt(views, h.index) as ChunkMeta;
    const parent = parentAt(views, h.index);
    return {
      ...entry,
      score: 0,
      cosine: h.cosine,
      parentText: parent?.text ?? entry.text,
      neighbor: true,
    };
  });

  return [...chunks, ...extra];
}

/** Full retrieval pipeline against explicitly-provided stores (used by tests
 *  and the cached default). Single-store; behaviour unchanged from before the
 *  multi-store refactor. */
export async function retrieveWith(
  query: string,
  stores: Stores,
  opts: RetrieveOpts = {}
): Promise<RetrievalResult> {
  const embedder = opts.embedder ?? getEmbedder();
  const queryVec = await embedder.embedQuery(query);
  const views = buildViews([stores]);
  const { result } = await assemble(query, queryVec, views, opts);
  return result;
}

/** Retrieval across several stores as ONE wiki (SPEC-BRAIN.md Sec3.4):
 *  foundation ⊕ brain delta in a unified ranking, plus graph neighbour
 *  expansion. storesList[0] is the foundation; later entries are deltas. */
export async function retrieveMulti(
  query: string,
  storesList: Stores[],
  opts: RetrieveOpts = {}
): Promise<RetrievalResult> {
  const embedder = opts.embedder ?? getEmbedder();
  const queryVec = await embedder.embedQuery(query);
  const views = buildViews(storesList);
  const { result, selectedIdx } = await assemble(query, queryVec, views, opts);

  const expansionOn = opts.graphExpansion ?? GRAPH_EXPANSION;
  if (expansionOn) {
    const limit = opts.neighborLimit ?? NEIGHBOR_LIMIT;
    result.chunks = expandNeighbours(result.chunks, selectedIdx, views, queryVec, limit);
  }
  return result;
}

// ── Public entrypoint (cached default stores) ────────────────────────────────────

let _default: Stores | null = null;

export async function retrieve(
  query: string,
  nodeId?: string,
  opts: RetrieveOpts = {}
): Promise<RetrievalResult> {
  if (!_default) _default = loadStores(DATA_DIR);
  return retrieveWith(query, _default, { ...opts, nodeId });
}

/** The cached foundation stores, loaded once. Exposed so the brain retrieval
 *  layer can compose them with a per-brain delta without re-reading disk. */
export async function getFoundationStores(): Promise<Stores> {
  if (!_default) _default = loadStores(DATA_DIR);
  return _default;
}

/** Invalidate the cached default stores (after rebuilding the index). */
export function clearCache(): void {
  _default = null;
}
