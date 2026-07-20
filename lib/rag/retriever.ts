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
import { getNode } from "@/lib/content/tree";
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
  NODE_BOOST,
  TOP_K,
  SCRAPE_CAP,
  FALLBACK_THRESHOLD,
  RERANK_POOL_SIZE,
  DEDUP_COSINE_THRESHOLD,
  EMBEDDING_DIM,
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
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

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

  const dim =
    entries.length > 0
      ? Math.round(vectors.length / entries.length)
      : EMBEDDING_DIM;
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

/** Full retrieval pipeline against explicitly-provided stores (used by tests). */
export async function retrieveWith(
  query: string,
  stores: Stores,
  opts: RetrieveOpts = {}
): Promise<RetrievalResult> {
  const { entries, store, lexical, parents, scenarioVecs } = stores;
  const nodeId = opts.nodeId;
  const poolSize = opts.poolSize ?? RERANK_POOL_SIZE;
  const topK = opts.topK ?? TOP_K;
  const scrapeCap = opts.scrapeCap ?? SCRAPE_CAP;
  // Read the toggle live (not a module constant) so tests can flip it regardless
  // of import order. Opt-in: the cross-encoder isn't present in the offline dev
  // box, so default off until RERANK_ENABLED=true.
  const rerankOn = opts.rerank ?? process.env.RERANK_ENABLED === "true";

  const embedder = opts.embedder ?? getEmbedder();
  const queryVec = await embedder.embedQuery(query);

  // Candidate filter: always exclude scenarios; optionally hard-filter to a
  // node or pillar (precision + speed at scale).
  const notScenario = (i: number) => !entries[i].isScenario;
  let filter: (i: number) => boolean = notScenario;
  if (opts.filterToNode) {
    const target = opts.filterToNode;
    filter = (i) =>
      notScenario(i) && (entries[i] as ChunkMeta).nodeId === target;
  } else if (opts.pillar) {
    const target = opts.pillar;
    filter = (i) => {
      if (!notScenario(i)) return false;
      const id = (entries[i] as ChunkMeta).nodeId;
      return !!id && getNode(id)?.pillarSlug === target;
    };
  }

  // Dense + lexical recall over the same (filtered) candidate set.
  const denseHits = store.search(queryVec, poolSize, filter);
  const lexHits = lexicalSearch(lexical, query, poolSize).filter((h) =>
    filter(h.index)
  );

  const fused = rrfFuse([
    denseHits.map((h) => h.index),
    lexHits.map((h) => h.index),
  ]);

  type Scored = {
    index: number;
    entry: ChunkMeta;
    cosine: number;
    finalScore: number;
  };
  const pool: Scored[] = [...fused.keys()].map((index) => {
    const entry = entries[index] as ChunkMeta;
    const cosine = cosineSimilarity(queryVec, store.row(index));
    const tierW = entry.tier === "scrape" ? SCRAPE_WEIGHT : CURATED_WEIGHT;
    const boost = nodeId && entry.nodeId === nodeId ? NODE_BOOST : 1;
    return { index, entry, cosine, finalScore: fused.get(index)! * tierW * boost };
  });

  // Rerank: cross-encoder replaces the relevance signal; tier/boost reapplied on
  // top of a sigmoid-normalized score so the multipliers stay well-behaved.
  if (rerankOn && pool.length > 0) {
    const reranker = opts.reranker ?? getReranker();
    const scores = await reranker.rerank(
      query,
      pool.map((c) => c.entry.text)
    );
    pool.forEach((c, i) => {
      const tierW = c.entry.tier === "scrape" ? SCRAPE_WEIGHT : CURATED_WEIGHT;
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
      getVector: (i) => store.row(i),
    }
  );

  const chunks: RetrievalChunk[] = selected.map((s) => {
    const entry = entries[s.index] as ChunkMeta;
    const parent = entry.parentId ? parents[entry.parentId] : undefined;
    return {
      ...entry,
      score: s.score,
      cosine: s.cosine,
      parentText: parent?.text ?? entry.text,
    };
  });

  // Fallback signal: best dense cosine over ALL content (curated + scrape), so a
  // topic covered only by scrape doesn't spuriously trigger the "couldn't answer"
  // notice. Still raw dense cosine (not fused/reranked), so a coincidental lexical
  // hit can't fake coverage.
  const bestHit = store.search(queryVec, 1, notScenario);
  const bestContentCosine = bestHit.length > 0 ? bestHit[0].cosine : 0;
  const { fallbackUsed, fallbackScenario } = computeFallback(
    queryVec,
    scenarioVecs,
    bestContentCosine,
    chunks.length,
    FALLBACK_THRESHOLD
  );

  return { chunks, fallbackUsed, fallbackScenario };
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

/** Invalidate the cached default stores (after rebuilding the index). */
export function clearCache(): void {
  _default = null;
}
