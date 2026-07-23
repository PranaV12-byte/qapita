import fs from "node:fs";
import { PILLARS, ALL_NODES } from "../content/tree";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE } from "../rag/config";
import { brainStore, type BrainStore, type BrainAnswer } from "./store";
import { loadGraph } from "./weave";

// ── Graph render model (SPEC-BRAIN.md Phase 6) ──────────────────────────────────
// Composes the shared foundation (pillars → topics → general, from tree.ts)
// with a per-brain overlay (u-nodes, source satellites, weave edges,
// crossLinks, summaries, backlinks) into ONE positioned graph. The layout is a
// DETERMINISTIC radial placement — same inputs → identical positions (no
// Math.random), so it's snapshot-stable and SSR/CSR-consistent.

export type RenderNodeKind = "pillar" | "topic" | "general" | "user-node" | "source";
export type RenderEdgeKind = "tree" | "related" | "weave";

export type RenderNode = {
  id: string;
  kind: RenderNodeKind;
  label: string;
  x: number;
  y: number;
  r: number;
  /** Present for topic/general/user-node: a short summary (from graph.json). */
  summary?: string;
  /** Passage count feeding this node (topics/user-nodes) or in this source. */
  passageCount?: number;
  /** How many logged answers cited this node/source (backlink strength). */
  citedByAnswers?: number;
  /** Source-node only: the tree/user nodes it feeds. */
  feedsNodeIds?: string[];
  /** Topic/user-node only: the source ids feeding it. */
  feedingSourceIds?: string[];
  pillarSlug?: string;
  /** Number of edges touching this node — the graph renderer sizes nodes by it
   *  so well-connected hubs read larger (SPEC-VAULT V2). */
  degree?: number;
};

export type RenderEdge = { from: string; to: string; kind: RenderEdgeKind };

export type GraphModel = {
  nodes: RenderNode[];
  edges: RenderEdge[];
  hasUserContent: boolean;
};

export type ComposeOpts = {
  store?: BrainStore;
  /** Curated node→node "related" pairs (from article frontmatter), supplied by
   *  the page. Kept as an input so this module stays pure + unit-testable
   *  without loading MDX content. */
  relatedTreeEdges?: { a: string; b: string }[];
};

// Layout radii (SVG user units; the client scales via viewBox).
const R_PILLAR = 300;
const R_TOPIC = 500;
const R_USER = 660;
const R_SOURCE = 820;
const TOPIC_FAN_DEG = 46;

const deg2rad = (d: number) => (d * Math.PI) / 180;

/** Stable [-1, 1) jitter from a string id — deterministic, no RNG. */
function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 2000) / 1000 - 1;
}

function polar(radius: number, angleDeg: number): { x: number; y: number } {
  return {
    x: Math.round(Math.cos(deg2rad(angleDeg)) * radius),
    y: Math.round(Math.sin(deg2rad(angleDeg)) * radius),
  };
}

function readAnswers(store: BrainStore, brainId: string): BrainAnswer[] {
  const { answersPath } = store.brainPaths(brainId);
  if (!fs.existsSync(answersPath)) return [];
  return fs
    .readFileSync(answersPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as BrainAnswer;
      } catch {
        return null;
      }
    })
    .filter((a): a is BrainAnswer => a !== null);
}

export function composeGraphModel(brainId: string | null, opts: ComposeOpts = {}): GraphModel {
  const store = opts.store ?? brainStore;
  const nodes: RenderNode[] = [];
  const edges: RenderEdge[] = [];
  const angleOf = new Map<string, number>();

  // ── Foundation: 7 pillars on a ring, topics fanned around each ──
  PILLARS.forEach((pillar, pi) => {
    const pillarAngle = -90 + (360 / PILLARS.length) * pi;
    angleOf.set(`pillar:${pillar.slug}`, pillarAngle);
    const pp = polar(R_PILLAR, pillarAngle);
    nodes.push({
      id: `pillar:${pillar.slug}`,
      kind: "pillar",
      label: pillar.title,
      x: pp.x,
      y: pp.y,
      r: 26,
      pillarSlug: pillar.slug,
    });

    const k = pillar.nodes.length;
    pillar.nodes.forEach((node, ni) => {
      const spread = k > 1 ? (ni / (k - 1) - 0.5) * TOPIC_FAN_DEG : 0;
      const a = pillarAngle + spread;
      angleOf.set(node.id, a);
      const tp = polar(R_TOPIC, a);
      nodes.push({
        id: node.id,
        kind: "topic",
        label: node.title,
        x: tp.x,
        y: tp.y,
        r: 14,
        pillarSlug: pillar.slug,
        feedingSourceIds: [],
      });
      edges.push({ from: `pillar:${pillar.slug}`, to: node.id, kind: "tree" });
    });
  });

  // general bucket (not a pillar member) — parked at the bottom.
  angleOf.set(GENERAL_NODE_ID, 90);
  const gp = polar(R_TOPIC, 90);
  nodes.push({
    id: GENERAL_NODE_ID,
    kind: "general",
    label: GENERAL_NODE_TITLE,
    x: gp.x,
    y: gp.y,
    r: 14,
    feedingSourceIds: [],
  });

  // Curated related edges (supplied by the page; deduped, both endpoints must exist).
  const nodeIds = new Set(nodes.map((n) => n.id));
  const seenRelated = new Set<string>();
  for (const { a, b } of opts.relatedTreeEdges ?? []) {
    if (!nodeIds.has(a) || !nodeIds.has(b) || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seenRelated.has(key)) continue;
    seenRelated.add(key);
    edges.push({ from: a, to: b, kind: "related" });
  }

  // ── Brain overlay ──
  const manifest = brainId ? store.loadManifest(brainId) : null;
  const graph = brainId ? loadGraph(brainId, { store }) : null;
  const answers = brainId ? readAnswers(store, brainId) : [];

  const answerCiteCount = (predicate: (c: BrainAnswer["citations"][number]) => boolean): number =>
    answers.filter((ans) => ans.citations.some(predicate)).length;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  if (manifest && graph) {
    // user-nodes (u-) — outer ring, angle by id hash
    for (const un of Object.values(graph.userNodes)) {
      const a = hashJitter(un.id) * 180;
      angleOf.set(un.id, a);
      const p = polar(R_USER, a);
      const node: RenderNode = {
        id: un.id,
        kind: "user-node",
        label: un.title,
        x: p.x,
        y: p.y,
        r: 14,
        summary: graph.nodeSummaries[un.id],
        feedingSourceIds: [],
        citedByAnswers: answerCiteCount((c) => c.nodeId === un.id),
      };
      nodes.push(node);
      nodeById.set(un.id, node);
    }

    // attach summaries + backlink counts to any foundation node the brain touched
    for (const [nodeId, summary] of Object.entries(graph.nodeSummaries)) {
      const n = nodeById.get(nodeId);
      if (n && n.kind !== "user-node") {
        n.summary = summary;
        n.citedByAnswers = answerCiteCount((c) => c.nodeId === nodeId);
      }
    }

    // sources → satellites feeding their nodes (weave edges)
    const perSourceNodes = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!perSourceNodes.has(edge.sourceId)) perSourceNodes.set(edge.sourceId, []);
      perSourceNodes.get(edge.sourceId)!.push(edge.nodeId);
      const target = nodeById.get(edge.nodeId);
      if (target && target.feedingSourceIds) target.feedingSourceIds.push(edge.sourceId);
    }

    for (const src of Object.values(manifest.sources)) {
      const feeds = perSourceNodes.get(src.sourceId) ?? [];
      // place the satellite near the mean angle of the nodes it feeds
      const angles = feeds.map((nid) => angleOf.get(nid)).filter((a): a is number => a !== undefined);
      const baseAngle =
        angles.length > 0 ? angles.reduce((s, a) => s + a, 0) / angles.length : hashJitter(src.sourceId) * 180;
      const a = baseAngle + hashJitter(src.sourceId) * 12;
      const p = polar(R_SOURCE, a);
      nodes.push({
        id: `source:${src.sourceId}`,
        kind: "source",
        label: src.fileName,
        x: p.x,
        y: p.y,
        r: 10 + Math.min(10, src.passageCount),
        passageCount: src.passageCount,
        feedsNodeIds: feeds,
        citedByAnswers: answerCiteCount((c) => c.sourceId === src.sourceId),
      });
      for (const nid of feeds) {
        edges.push({ from: `source:${src.sourceId}`, to: nid, kind: "weave" });
      }
    }

    // crossLinks → related edges between nodes the user's content connected
    for (const link of graph.crossLinks) {
      if (nodeById.has(link.a) && nodeById.has(link.b)) {
        edges.push({ from: link.a, to: link.b, kind: "related" });
      }
    }
  }

  // Node degree (edges touching each node) — the renderer sizes by it.
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  for (const n of nodes) n.degree = degree.get(n.id) ?? 0;

  return {
    nodes,
    edges,
    hasUserContent: !!manifest && Object.keys(manifest.sources).length > 0,
  };
}
