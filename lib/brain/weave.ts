import fs from "node:fs";
import path from "node:path";
import { chunkMarkdown, type ChunkResult, type SectionResult } from "../rag/chunker";
import { buildLexicalIndex } from "../rag/lexical";
import { getEmbedder, embedInBlocks } from "../rag/embedder";
import { buildEmbedInput } from "../../scripts/ingest/contextualize";
import { getNode } from "../content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE } from "../rag/config";
import { brainStore, atomicWriteFileSync, type BrainStore, type BrainManifest } from "./store";
import { summarizeNode, type RawLLMCaller } from "./maintain";
import type { ExistingSourceProbe } from "./healthCheck";
import type { ChunkMeta, ParentSection, Embedder } from "../rag/types";
import type { PlacementPlan } from "./placement";

export type { PlacementPlan, NewNodeProposal } from "./placement";

// ── The weave engine (SPEC-BRAIN.md Phase 3) ────────────────────────────────────
// Executes a PlacementPlan: chunks + embeds a document, appends it atomically
// (under the brain mutex) to the brain's delta index, mirroring
// scripts/ingest/build.ts's addDoc ordering — entries[] and their embed
// inputs grow in lockstep so vectors.bin row i always == chunks.json[i] ==
// lexical doc id i. Also removeSource() (filter + full rewrite) and the
// graph/manifest/catalog/journal bookkeeping around both.

export type GraphUserNode = { id: string; title: string; createdAt: string };
export type GraphEdge = { sourceId: string; nodeId: string; passageCount: number };
/** Node↔node "related" link, inferred by co-occurrence (a source that feeds
 *  both nodes). `a` < `b` lexically so pairs dedupe regardless of order. */
export type CrossLink = { a: string; b: string };
export type BrainGraph = {
  userNodes: Record<string, GraphUserNode>;
  edges: GraphEdge[];
  crossLinks: CrossLink[];
  /** nodeId → concise summary (LLM when a provider is on, extractive otherwise). */
  nodeSummaries: Record<string, string>;
};

export type WeaveReport = {
  sourceId: string;
  perNode: Record<string, number>;
  newNodes: { id: string; title: string }[];
  totalPassages: number;
};

export type WeaveSourceParams = {
  brainId: string;
  sourceId: string;
  fileName: string;
  format: string;
  originalBuffer: Buffer;
  title: string;
  markdown: string;
  plan: PlacementPlan;
  contentHash: string;
  probeVector: Float32Array;
  embedder?: Embedder;
  /** Injectable for tests; defaults to the real data/brains-backed store. */
  store?: BrainStore;
  /** LLM caller for node summaries (maintain.ts). Null/offline → extractive. */
  caller?: RawLLMCaller;
  /** Single-pass ingest (V0): chunks + chunk vectors already computed upstream
   *  (chunked with docId === this sourceId), so weave skips re-chunk/re-embed.
   *  Omitted → weave chunks + embeds internally (the pre-V0 path; tests + any
   *  direct caller rely on this still working unchanged). */
  precomputed?: {
    chunks: ChunkResult[];
    sections: SectionResult[];
    chunkedTitle: string;
    chunkVecs: Float32Array[];
  };
  /** Progress during internal embedding (ignored when precomputed vectors are
   *  supplied, since embedding then happened upstream with its own reporting). */
  onProgress?: (current: number, total: number) => void;
};

const MAX_SUMMARY_NODES_PER_INGEST = 10;

const emptyGraph = (): BrainGraph => ({
  userNodes: {},
  edges: [],
  crossLinks: [],
  nodeSummaries: {},
});

function nodeTitleFor(nodeId: string, graph: BrainGraph): string {
  if (nodeId === GENERAL_NODE_ID) return GENERAL_NODE_TITLE;
  if (nodeId.startsWith("u-")) return graph.userNodes[nodeId]?.title ?? nodeId;
  return getNode(nodeId)?.title ?? nodeId;
}

function addCrossLink(graph: BrainGraph, x: string, y: string): void {
  const [a, b] = x < y ? [x, y] : [y, x];
  if (a === b) return;
  if (!graph.crossLinks.some((l) => l.a === a && l.b === b)) {
    graph.crossLinks.push({ a, b });
  }
}

function graphPath(store: BrainStore, brainId: string): string {
  return path.join(store.brainPaths(brainId).dir, "graph.json");
}

export function loadGraph(brainId: string, opts: { store?: BrainStore } = {}): BrainGraph {
  const store = opts.store ?? brainStore;
  const gp = graphPath(store, brainId);
  if (!fs.existsSync(gp)) return emptyGraph();
  const raw = JSON.parse(fs.readFileSync(gp, "utf-8")) as Partial<BrainGraph>;
  // Normalize: older graphs (pre-crossLinks) must not crash a push().
  return {
    userNodes: raw.userNodes ?? {},
    edges: raw.edges ?? [],
    crossLinks: raw.crossLinks ?? [],
    nodeSummaries: raw.nodeSummaries ?? {},
  };
}

export function saveGraph(store: BrainStore, brainId: string, graph: BrainGraph): void {
  atomicWriteFileSync(graphPath(store, brainId), JSON.stringify(graph, null, 2));
}

type DeltaRaw = {
  entries: ChunkMeta[];
  parents: Record<string, ParentSection>;
  vectors: Float32Array;
  dim: number;
};

function loadDeltaRaw(store: BrainStore, brainId: string): DeltaRaw {
  const { dir } = store.brainPaths(brainId);
  const chunksPath = path.join(dir, "chunks.json");
  const vectorsPath = path.join(dir, "vectors.bin");
  const parentsPath = path.join(dir, "parents.json");

  if (!fs.existsSync(chunksPath) || !fs.existsSync(vectorsPath)) {
    return { entries: [], parents: {}, vectors: new Float32Array(0), dim: 0 };
  }
  const entries = JSON.parse(fs.readFileSync(chunksPath, "utf-8")) as ChunkMeta[];
  const buf = fs.readFileSync(vectorsPath);
  const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const dim = entries.length > 0 ? Math.round(vectors.length / entries.length) : 0;
  const parents = fs.existsSync(parentsPath)
    ? (JSON.parse(fs.readFileSync(parentsPath, "utf-8")) as Record<string, ParentSection>)
    : {};
  return { entries, parents, vectors, dim };
}

function writeDeltaRaw(
  store: BrainStore,
  brainId: string,
  entries: ChunkMeta[],
  parents: Record<string, ParentSection>,
  vectors: Float32Array
): void {
  const { dir } = store.brainPaths(brainId);
  atomicWriteFileSync(
    path.join(dir, "vectors.bin"),
    Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength)
  );
  atomicWriteFileSync(path.join(dir, "chunks.json"), JSON.stringify(entries));
  atomicWriteFileSync(path.join(dir, "parents.json"), JSON.stringify(parents));
  atomicWriteFileSync(
    path.join(dir, "lexical-index.json"),
    JSON.stringify(buildLexicalIndex(entries))
  );
}

function regenerateCatalog(store: BrainStore, brainId: string, manifest: BrainManifest): void {
  const lines = Object.values(manifest.sources).map(
    (s) =>
      `- **${s.fileName}** (${s.format}, ${s.passageCount} passages) -> ${
        s.nodeIds.join(", ") || "(none)"
      }`
  );
  const { dir } = store.brainPaths(brainId);
  atomicWriteFileSync(path.join(dir, "catalog.md"), lines.join("\n") + "\n");
}

/** Reads the persisted per-source probes (content hash + embedding) so a new
 *  upload's health check can compare against real prior sources. */
export function getExistingSourceProbes(
  brainId: string,
  opts: { store?: BrainStore } = {}
): ExistingSourceProbe[] {
  const store = opts.store ?? brainStore;
  const manifest = store.loadManifest(brainId);
  if (!manifest) return [];
  return Object.values(manifest.sources).map((s) => ({
    sourceId: s.sourceId,
    contentHash: s.contentHash,
    probeVector: Float32Array.from(s.probeVector),
  }));
}

export async function weaveSource(params: WeaveSourceParams): Promise<WeaveReport> {
  const {
    brainId,
    sourceId,
    fileName,
    format,
    originalBuffer,
    title,
    markdown,
    plan,
    contentHash,
    probeVector,
  } = params;
  const store = params.store ?? brainStore;
  const embedder = params.embedder ?? getEmbedder();

  return store.withLock(brainId, async () => {
    if (!store.brainExists(brainId)) store.createBrain(brainId);

    const { entries: existingEntries, parents: existingParents, vectors: existingVectors, dim: existingDim } =
      loadDeltaRaw(store, brainId);
    const graph = loadGraph(brainId, { store });

    // Resolve new-node id collisions against nodes this brain already has.
    const idRemap = new Map<string, string>();
    for (const node of plan.newNodes) {
      let finalId = node.id;
      let n = 2;
      while (graph.userNodes[finalId]) {
        finalId = `${node.id}-${n}`;
        n++;
      }
      idRemap.set(node.id, finalId);
      graph.userNodes[finalId] = { id: finalId, title: node.title, createdAt: new Date().toISOString() };
    }
    const resolveNodeId = (id: string) => idRemap.get(id) ?? id;

    // Single-pass (V0): reuse the upstream chunks + vectors. Otherwise chunk +
    // embed here (pre-V0 path). Either way `docId === sourceId`, so parentIds
    // and the vectors↔chunks↔lexical row alignment are identical.
    const pre = params.precomputed;
    const { chunks, sections, title: chunkedTitle } = pre
      ? { chunks: pre.chunks, sections: pre.sections, title: pre.chunkedTitle }
      : chunkMarkdown(markdown, { docId: sourceId, title });

    const parentIdToNodeId = new Map<string, string>();
    sections.forEach((s, i) => {
      parentIdToNodeId.set(s.parentId, resolveNodeId(plan.sectionNodeIds[i]));
    });

    const newParents: Record<string, ParentSection> = {};
    sections.forEach((s) => {
      newParents[s.parentId] = {
        parentId: s.parentId,
        nodeId: parentIdToNodeId.get(s.parentId),
        title: chunkedTitle,
        headingPath: s.headingPath,
        text: s.text,
      };
    });

    const newEntries: ChunkMeta[] = chunks.map((c) => ({
      tier: "user",
      nodeId: parentIdToNodeId.get(c.parentId),
      sourceId,
      title: chunkedTitle,
      headingPath: c.headingPath,
      parentId: c.parentId,
      text: c.text,
      isScenario: false,
    }));

    let newVectors: Float32Array[];
    if (pre) {
      newVectors = pre.chunkVecs;
    } else {
      const embedInputs: string[] = [];
      for (const c of chunks) {
        embedInputs.push(await buildEmbedInput(chunkedTitle, c.headingPath, c.text));
      }
      newVectors = await embedInBlocks(null, embedder, embedInputs, 16, params.onProgress);
    }
    const dim = existingDim > 0 ? existingDim : newVectors[0]?.length ?? embedder.dim;

    const allEntries = [...existingEntries, ...newEntries];
    const allParents = { ...existingParents, ...newParents };
    const flat = new Float32Array(allEntries.length * dim);
    flat.set(existingVectors, 0);
    newVectors.forEach((v, i) => flat.set(v, (existingEntries.length + i) * dim));

    writeDeltaRaw(store, brainId, allEntries, allParents, flat);

    // ── sources/<sourceId>/ — original bytes + the already-extracted markdown ──
    const { dir } = store.brainPaths(brainId);
    const sourceDir = path.join(dir, "sources", sourceId);
    fs.mkdirSync(sourceDir, { recursive: true });
    const ext = path.extname(fileName) || ".bin";
    fs.writeFileSync(path.join(sourceDir, `original${ext}`), originalBuffer);
    fs.writeFileSync(path.join(sourceDir, "extracted.md"), markdown);

    // ── manifest ──
    const perNode: Record<string, number> = {};
    newEntries.forEach((e) => {
      if (e.nodeId) perNode[e.nodeId] = (perNode[e.nodeId] ?? 0) + 1;
    });
    const manifest = store.loadManifest(brainId)!;
    manifest.sources[sourceId] = {
      sourceId,
      fileName,
      format,
      addedAt: new Date().toISOString(),
      nodeIds: Object.keys(perNode),
      passageCount: newEntries.length,
      contentHash,
      probeVector: Array.from(probeVector),
    };
    manifest.counts.sources += 1;
    manifest.counts.passages += newEntries.length;
    manifest.lint.appendsSinceLint += 1;
    store.saveManifest(brainId, manifest);

    // ── graph edges ──
    Object.entries(perNode).forEach(([nodeId, count]) => {
      graph.edges.push({ sourceId, nodeId, passageCount: count });
    });

    // ── cross-links: a source feeding multiple nodes relates those nodes ──
    const touched = Object.keys(perNode);
    for (let i = 0; i < touched.length; i++) {
      for (let j = i + 1; j < touched.length; j++) addCrossLink(graph, touched[i], touched[j]);
    }

    // ── node summaries for the nodes this ingest touched (bounded budget) ──
    for (const nodeId of touched.slice(0, MAX_SUMMARY_NODES_PER_INGEST)) {
      const texts = allEntries.filter((e) => e.nodeId === nodeId).map((e) => e.text);
      graph.nodeSummaries[nodeId] = await summarizeNode(nodeTitleFor(nodeId, graph), texts, {
        caller: params.caller,
      });
    }

    saveGraph(store, brainId, graph);

    // ── catalog + journal ──
    regenerateCatalog(store, brainId, manifest);
    store.appendJournal(
      brainId,
      `## [${new Date().toISOString()}] ingest | ${fileName} -> ${
        Object.keys(perNode).join(", ") || "(no passages)"
      } (${newEntries.length} passages)`
    );

    store.cache.invalidate(brainId);

    return {
      sourceId,
      perNode,
      newNodes: plan.newNodes.map((n) => ({ id: resolveNodeId(n.id), title: n.title })),
      totalPassages: newEntries.length,
    };
  });
}

export async function removeSource(
  brainId: string,
  sourceId: string,
  opts: { store?: BrainStore } = {}
): Promise<{ sourceId: string; removedPassages: number }> {
  const store = opts.store ?? brainStore;

  return store.withLock(brainId, async () => {
    const { entries, parents, vectors, dim } = loadDeltaRaw(store, brainId);
    const keepIdx: number[] = [];
    entries.forEach((e, i) => {
      if (e.sourceId !== sourceId) keepIdx.push(i);
    });
    const removedCount = entries.length - keepIdx.length;

    const keptEntries = keepIdx.map((i) => entries[i]);
    const keptParentIds = new Set(
      keptEntries.map((e) => e.parentId).filter((p): p is string => !!p)
    );
    const keptParents: Record<string, ParentSection> = {};
    Object.entries(parents).forEach(([pid, p]) => {
      if (keptParentIds.has(pid)) keptParents[pid] = p;
    });

    const flat = new Float32Array(keptEntries.length * dim);
    keepIdx.forEach((oldI, newI) => {
      flat.set(vectors.subarray(oldI * dim, (oldI + 1) * dim), newI * dim);
    });

    writeDeltaRaw(store, brainId, keptEntries, keptParents, flat);

    // The source's original + extracted files are no longer referenced by
    // anything — remove them so nothing points at deleted content.
    const { dir } = store.brainPaths(brainId);
    fs.rmSync(path.join(dir, "sources", sourceId), { recursive: true, force: true });

    const manifest = store.loadManifest(brainId);
    if (manifest && manifest.sources[sourceId]) {
      delete manifest.sources[sourceId];
      manifest.counts.sources = Math.max(0, manifest.counts.sources - 1);
      manifest.counts.passages = Math.max(0, manifest.counts.passages - removedCount);
      store.saveManifest(brainId, manifest);
      regenerateCatalog(store, brainId, manifest);
    }

    // Edges are removed; an orphaned u-node (now with zero edges) is left in
    // place for Phase 5's lint to detect and report — not silently deleted.
    const graph = loadGraph(brainId, { store });
    graph.edges = graph.edges.filter((e) => e.sourceId !== sourceId);
    saveGraph(store, brainId, graph);

    store.appendJournal(
      brainId,
      `## [${new Date().toISOString()}] remove | source ${sourceId} (${removedCount} passages)`
    );
    store.cache.invalidate(brainId);

    return { sourceId, removedPassages: removedCount };
  });
}
