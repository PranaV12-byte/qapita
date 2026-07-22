import {
  getFoundationStores,
  loadStores,
  retrieveMulti,
  retrieveWith,
  type Stores,
  type RetrieveOpts,
} from "../rag/retriever";
import { getNode } from "../content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE } from "../rag/config";
import { brainStore, type BrainStore } from "./store";
import { loadGraph } from "./weave";
import type { RetrievalChunk, RetrievalResult, Citation } from "../rag/types";

// ── Brain-aware retrieval (SPEC-BRAIN.md Phase 4) ───────────────────────────────
// Composes the shared foundation with a per-brain delta index into ONE wiki
// and queries it. An empty brain (no delta on disk) transparently falls back
// to the foundation-only path — byte-identical to today's behaviour.

/** Loads a brain's delta Stores, caching the parsed result on the store's LRU
 *  (invalidated by store.saveManifest / weave / erase). Returns null when the
 *  brain has no delta yet. */
export function loadBrainDelta(brainId: string, opts: { store?: BrainStore } = {}): Stores | null {
  const store = opts.store ?? brainStore;
  const { dir } = store.brainPaths(brainId);
  const cacheKey = `delta:${brainId}`;

  const cached = store.cache.get(cacheKey) as Stores | undefined;
  if (cached) return cached;

  // loadStores throws if vectors.bin/chunks.json are absent — that's the
  // "empty brain" signal, not an error worth surfacing.
  try {
    const stores = loadStores(dir);
    if (stores.entries.length === 0) return null;
    store.cache.set(cacheKey, stores);
    return stores;
  } catch {
    return null;
  }
}

/** Retrieve against a user's whole wiki. No brainId, or an empty brain →
 *  foundation-only (identical to the pre-brain path). */
export async function retrieveForBrain(
  query: string,
  brainId: string | null,
  opts: RetrieveOpts = {}
): Promise<RetrievalResult> {
  const foundation = await getFoundationStores();
  const delta = brainId ? loadBrainDelta(brainId) : null;
  if (!delta) {
    return retrieveWith(query, foundation, opts);
  }
  return retrieveMulti(query, [foundation, delta], opts);
}

// ── Citation resolution ─────────────────────────────────────────────────────────
// Turns retrieved chunks into user-facing citations with a resolved label and
// a `kind` the UI links on. Done SERVER-SIDE so no LLM provider can drop a
// citation just because getNode() returned undefined for a user-node id — the
// confirmed pre-Phase-4 gap.

/** Resolve a single chunk's citation identity, or null if it carries none. */
function citationFor(chunk: RetrievalChunk, brainId: string | null): Citation | null {
  // A user-tier chunk cites either its uploaded source or its brain-local node.
  if (chunk.tier === "user") {
    if (chunk.sourceId) {
      const fileName = brainId ? sourceFileName(brainId, chunk.sourceId) : undefined;
      return {
        kind: "source",
        sourceId: chunk.sourceId,
        title: fileName ?? chunk.title ?? "Your source",
      };
    }
    if (chunk.nodeId && chunk.nodeId.startsWith("u-")) {
      const label = brainId ? userNodeTitle(brainId, chunk.nodeId) : undefined;
      return { kind: "user-node", nodeId: chunk.nodeId, title: label ?? chunk.title ?? "Your topic" };
    }
  }

  // Foundation chunk → a curated topic-tree node (or the general bucket).
  if (!chunk.nodeId) return null;
  if (chunk.nodeId === GENERAL_NODE_ID) {
    return { kind: "topic", nodeId: chunk.nodeId, title: GENERAL_NODE_TITLE };
  }
  const node = getNode(chunk.nodeId);
  if (!node) return null;
  return { kind: "topic", nodeId: chunk.nodeId, title: node.title };
}

function sourceFileName(brainId: string, sourceId: string): string | undefined {
  const manifest = brainStore.loadManifest(brainId);
  return manifest?.sources[sourceId]?.fileName;
}

function userNodeTitle(brainId: string, nodeId: string): string | undefined {
  return loadGraph(brainId).userNodes[nodeId]?.title;
}

/** Distinct citations for a set of chunks, order-preserving. De-duplicated by
 *  the identity the UI links on (sourceId for sources, nodeId otherwise). */
export function resolveCitations(chunks: RetrievalChunk[], brainId: string | null): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of chunks) {
    const cite = citationFor(c, brainId);
    if (!cite) continue;
    const key = `${cite.kind}:${cite.sourceId ?? cite.nodeId ?? cite.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cite);
  }
  return out;
}
