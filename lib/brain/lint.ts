import fs from "node:fs";
import path from "node:path";
import { cosineSimilarity } from "../rag/cosine";
import { getEmbedder } from "../rag/embedder";
import {
  DEDUP_COSINE_THRESHOLD,
  CLASSIFY_MIN_CONFIDENCE,
  LINT_STALE_DAYS,
  GENERAL_NODE_TITLE,
} from "../rag/config";
import { ALL_NODES, PILLARS, getNode } from "../content/tree";
import { brainStore, atomicWriteFileSync, type BrainStore, type BrainManifest } from "./store";
import { loadGraph, saveGraph, type BrainGraph } from "./weave";
import { getNodeTargets } from "./healthCheck";
import { reviewWiki, type RawLLMCaller } from "./maintain";
import type { Embedder } from "../rag/types";

/** Titles a `[[wiki-link]]` may resolve to: every tree topic, pillar, the
 *  general bucket, this brain's u-nodes, and its uploaded source filenames.
 *  Lowercased for case-insensitive matching. Shared by the broken-link
 *  detector and its auto-fix so both agree on "resolvable". */
function knownLinkTitles(graph: BrainGraph, manifest: BrainManifest | null): Set<string> {
  const s = new Set<string>();
  for (const n of ALL_NODES) s.add(n.title.toLowerCase());
  for (const p of PILLARS) s.add(p.title.toLowerCase());
  s.add(GENERAL_NODE_TITLE.toLowerCase());
  for (const un of Object.values(graph.userNodes)) s.add(un.title.toLowerCase());
  if (manifest) for (const src of Object.values(manifest.sources)) s.add(src.fileName.toLowerCase());
  return s;
}

function wikiLinkRe(): RegExp {
  return /\[\[([^\]]+)\]\]/g;
}

// ── Lint: periodic wiki health check (SPEC-BRAIN.md Phase 5, Karpathy's 3rd op) ──
// Heuristic detectors always run; an LLM review is layered on when a provider
// is configured. Nothing destructive happens here — findings only describe and
// suggest; structural fixes are auto-applicable via applyFinding, content
// removals route through the existing DELETE endpoints after user confirm.

export type LintSeverity = "info" | "warn";

export type LintFinding = {
  id: string;
  type: string;
  severity: LintSeverity;
  message: string;
  suggestedAction: string;
  autoApplicable: boolean;
  sourceIds: string[];
  nodeIds: string[];
};

export type LintReport = {
  generatedAt: string;
  findings: LintFinding[];
  dismissed: string[];
  applied: string[];
};

export type LintOpts = {
  embedder?: Embedder;
  dataDir?: string;
  caller?: RawLLMCaller;
  store?: BrainStore;
  /** Injectable clock for staleness (tests pin it). Defaults to now. */
  now?: Date;
};

function lintPath(store: BrainStore, brainId: string): string {
  return path.join(store.brainPaths(brainId).dir, "lint-report.json");
}

export function loadLintReport(brainId: string, opts: { store?: BrainStore } = {}): LintReport | null {
  const store = opts.store ?? brainStore;
  const p = lintPath(store, brainId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as LintReport;
}

function saveLintReport(store: BrainStore, brainId: string, report: LintReport): void {
  atomicWriteFileSync(lintPath(store, brainId), JSON.stringify(report, null, 2));
}

export async function runLint(brainId: string, opts: LintOpts = {}): Promise<LintReport> {
  const store = opts.store ?? brainStore;
  const embedder = opts.embedder ?? getEmbedder();
  const dataDir = opts.dataDir ?? path.join(process.cwd(), "data");
  const now = opts.now ?? new Date();

  const manifest = store.loadManifest(brainId);
  const graph = loadGraph(brainId, { store });
  const findings: LintFinding[] = [];

  if (manifest) {
    const sources = Object.values(manifest.sources);

    // 1. near-duplicate sources (by stored probe cosine)
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const a = sources[i];
        const b = sources[j];
        if (a.contentHash && a.contentHash === b.contentHash) {
          findings.push(dup("exact_duplicate_sources", a.sourceId, b.sourceId, a.fileName, b.fileName, true));
          continue;
        }
        if (a.probeVector.length && b.probeVector.length) {
          const cos = cosineSimilarity(Float32Array.from(a.probeVector), Float32Array.from(b.probeVector));
          if (cos >= DEDUP_COSINE_THRESHOLD) {
            findings.push(dup("near_duplicate_sources", a.sourceId, b.sourceId, a.fileName, b.fileName, false));
          }
        }
      }
    }

    // 3. off-topic drift: a source whose probe is weakly related to every real
    //    node it was assigned to (u- nodes have no target, so they're skipped).
    const { targets, vectors } = await getNodeTargets(embedder, dataDir);
    const targetById = new Map(targets.map((t, i) => [t.id, vectors[i]]));
    for (const s of sources) {
      if (!s.probeVector.length) continue;
      const realNodeIds = s.nodeIds.filter((id) => targetById.has(id));
      if (realNodeIds.length === 0) continue;
      const probe = Float32Array.from(s.probeVector);
      const bestCos = Math.max(...realNodeIds.map((id) => cosineSimilarity(probe, targetById.get(id)!)));
      if (bestCos < CLASSIFY_MIN_CONFIDENCE) {
        findings.push({
          id: `off_topic_drift:${s.sourceId}`,
          type: "off_topic_drift",
          severity: "warn",
          message: `"${s.fileName}" no longer looks closely related to the topics it was filed under.`,
          suggestedAction: "Review this source; re-file or remove it.",
          autoApplicable: false,
          sourceIds: [s.sourceId],
          nodeIds: realNodeIds,
        });
      }
    }

    // 4. staleness
    const staleMs = LINT_STALE_DAYS * 24 * 60 * 60 * 1000;
    for (const s of sources) {
      const age = now.getTime() - new Date(s.addedAt).getTime();
      if (age > staleMs) {
        findings.push({
          id: `stale_source:${s.sourceId}`,
          type: "stale_source",
          severity: "info",
          message: `"${s.fileName}" was added more than ${LINT_STALE_DAYS} days ago.`,
          suggestedAction: "Confirm it's still current, or remove it.",
          autoApplicable: false,
          sourceIds: [s.sourceId],
          nodeIds: [],
        });
      }
    }

    // 5. broken edges (edge -> a source no longer in the manifest)
    const sourceIdSet = new Set(sources.map((s) => s.sourceId));
    for (const edge of graph.edges) {
      if (!sourceIdSet.has(edge.sourceId)) {
        findings.push({
          id: `broken_edge:${edge.sourceId}:${edge.nodeId}`,
          type: "broken_edge",
          severity: "warn",
          message: `A graph link points at a source (${edge.sourceId}) that no longer exists.`,
          suggestedAction: "Remove the dangling link.",
          autoApplicable: true,
          sourceIds: [edge.sourceId],
          nodeIds: [edge.nodeId],
        });
      }
    }
  }

  // 2. orphan user-nodes: a u- node with no edge feeding it.
  const fedNodeIds = new Set(graph.edges.map((e) => e.nodeId));
  for (const nodeId of Object.keys(graph.userNodes)) {
    if (!fedNodeIds.has(nodeId)) {
      findings.push({
        id: `orphan_node:${nodeId}`,
        type: "orphan_node",
        severity: "info",
        message: `The topic "${graph.userNodes[nodeId].title}" has no sources feeding it.`,
        suggestedAction: "Remove the empty topic.",
        autoApplicable: true,
        sourceIds: [],
        nodeIds: [nodeId],
      });
    }
  }

  // 6. broken [[wiki-links]]: a note links to a title that resolves to nothing.
  //    Auto-applicable — the fix rewrites the dead link to plain text.
  const wikiDir = path.join(store.brainPaths(brainId).dir, "wiki");
  if (fs.existsSync(wikiDir)) {
    const known = knownLinkTitles(graph, manifest);
    for (const file of fs.readdirSync(wikiDir)) {
      if (!file.endsWith(".md")) continue;
      const stem = file.slice(0, -3);
      let content: string;
      try {
        content = fs.readFileSync(path.join(wikiDir, file), "utf-8");
      } catch {
        continue;
      }
      const broken = new Set<string>();
      for (const m of content.matchAll(wikiLinkRe())) {
        const t = m[1].trim();
        if (!known.has(t.toLowerCase())) broken.add(t);
      }
      if (broken.size > 0) {
        const noteTitle = getNode(stem)?.title ?? graph.userNodes[stem]?.title ?? stem;
        findings.push({
          id: `broken_link:${stem}`,
          type: "broken_link",
          severity: "info",
          message: `The note "${noteTitle}" links to ${[...broken]
            .map((b) => `"${b}"`)
            .join(", ")}, which no longer resolve${broken.size === 1 ? "s" : ""}.`,
          suggestedAction: "Rewrite the broken links as plain text.",
          autoApplicable: true,
          sourceIds: [],
          nodeIds: [stem],
        });
      }
    }
  }

  // Layered LLM review (empty offline / on failure).
  if (manifest) {
    const previews = Object.values(manifest.sources).map((s) => ({
      sourceId: s.sourceId,
      title: s.fileName,
      // Titles only — lint doesn't hold raw passage text; the LLM review works
      // from filenames + topics, and returns [] offline regardless.
      preview: s.fileName,
    }));
    const llm = await reviewWiki(previews, { caller: opts.caller });
    for (const f of llm) {
      findings.push({
        id: `llm:${f.type}:${f.sourceIds.join(",")}`,
        type: `llm_${f.type}`,
        severity: f.severity,
        message: f.message,
        suggestedAction: "Review the flagged sources.",
        autoApplicable: false,
        sourceIds: f.sourceIds,
        nodeIds: [],
      });
    }
  }

  // Preserve prior applied/dismissed decisions across re-runs.
  const prior = loadLintReport(brainId, { store });
  const report: LintReport = {
    generatedAt: now.toISOString(),
    findings,
    dismissed: prior?.dismissed ?? [],
    applied: prior?.applied ?? [],
  };
  saveLintReport(store, brainId, report);

  if (manifest) {
    manifest.lint.lastLintAt = report.generatedAt;
    manifest.lint.appendsSinceLint = 0;
    store.saveManifest(brainId, manifest);
  }

  return report;
}

function dup(
  type: string,
  aId: string,
  bId: string,
  aName: string,
  bName: string,
  exact: boolean
): LintFinding {
  const [x, y] = aId < bId ? [aId, bId] : [bId, aId];
  return {
    id: `${type}:${x}:${y}`,
    type,
    severity: "warn",
    message: `"${aName}" and "${bName}" look like ${exact ? "exact" : "near"} duplicates.`,
    suggestedAction: "Remove one of them.",
    autoApplicable: false,
    sourceIds: [aId, bId],
    nodeIds: [],
  };
}

/** Apply an auto-applicable structural fix, or record a dismissal. Destructive
 *  fixes (dup/drift/stale removals) are NOT executed here — they only ever get
 *  recorded, and the user removes content via the DELETE endpoints. */
export async function applyFinding(
  brainId: string,
  findingId: string,
  action: "apply" | "dismiss",
  opts: { store?: BrainStore } = {}
): Promise<{ ok: boolean; applied: boolean }> {
  const store = opts.store ?? brainStore;
  const report = loadLintReport(brainId, { store });
  if (!report) return { ok: false, applied: false };
  const finding = report.findings.find((f) => f.id === findingId);
  if (!finding) return { ok: false, applied: false };

  if (action === "dismiss") {
    if (!report.dismissed.includes(findingId)) report.dismissed.push(findingId);
    saveLintReport(store, brainId, report);
    return { ok: true, applied: false };
  }

  let applied = false;
  if (finding.autoApplicable) {
    const graph = loadGraph(brainId, { store });
    if (finding.type === "orphan_node") {
      for (const nodeId of finding.nodeIds) {
        delete graph.userNodes[nodeId];
        graph.crossLinks = graph.crossLinks.filter((l) => l.a !== nodeId && l.b !== nodeId);
      }
      applied = true;
    } else if (finding.type === "broken_edge") {
      graph.edges = graph.edges.filter(
        (e) => !(finding.sourceIds.includes(e.sourceId) && finding.nodeIds.includes(e.nodeId))
      );
      applied = true;
    } else if (finding.type === "broken_link") {
      // Rewrite unresolvable [[Title]] → plain "Title" in the affected notes.
      const manifest = store.loadManifest(brainId);
      const known = knownLinkTitles(graph, manifest);
      for (const stem of finding.nodeIds) {
        const p = path.join(store.brainPaths(brainId).dir, "wiki", `${stem}.md`);
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, "utf-8");
        const rewritten = content.replace(wikiLinkRe(), (full, title: string) =>
          known.has(title.trim().toLowerCase()) ? full : title.trim()
        );
        if (rewritten !== content) {
          atomicWriteFileSync(p, rewritten);
          applied = true;
        }
      }
    }
    if (applied && (finding.type === "orphan_node" || finding.type === "broken_edge")) {
      saveGraph(store, brainId, graph);
    }
  }

  if (!report.applied.includes(findingId)) report.applied.push(findingId);
  saveLintReport(store, brainId, report);
  return { ok: true, applied };
}
