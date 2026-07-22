import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runLint, applyFinding, loadLintReport } from "@/lib/brain/lint";
import { saveGraph, type BrainGraph } from "@/lib/brain/weave";
import { pruneBrains } from "@/scripts/brain/prune";
import { createBrainStore, type BrainStore, type BrainManifest } from "@/lib/brain/store";
import type { Embedder } from "@/lib/rag/types";

// Only node 3.2's target text ("RSU & ESPP tax") maps to a non-zero vector;
// every other node target → zero vector (cosine 0). Lets us make one source
// clearly on-topic for 3.2 and another clearly drifted.
class FakeEmbedder implements Embedder {
  readonly id = "fake-lint";
  readonly dim = 4;
  private v(text: string): Float32Array {
    return text.includes("RSU & ESPP tax") ? Float32Array.from([1, 0, 0, 0]) : new Float32Array(4);
  }
  async embedQuery(t: string) {
    return this.v(t);
  }
  async embedPassage(t: string) {
    return this.v(t);
  }
  async embedPassages(ts: string[]) {
    return ts.map((t) => this.v(t));
  }
}

const NOW = new Date("2026-07-23T00:00:00.000Z");
const OLD = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
const BRAIN = "aaaaaaaa-1111-2222-3333-444444444444";

function src(over: Partial<BrainManifest["sources"][string]>): BrainManifest["sources"][string] {
  return {
    sourceId: "s",
    fileName: "f.md",
    format: "markdown",
    addedAt: RECENT,
    nodeIds: [],
    passageCount: 1,
    contentHash: "h",
    probeVector: [0, 0, 0, 0],
    ...over,
  };
}

function seedBrain(store: BrainStore): void {
  store.createBrain(BRAIN);
  const manifest = store.loadManifest(BRAIN)!;
  manifest.sources = {
    "src-a": src({ sourceId: "src-a", fileName: "on-topic.md", nodeIds: ["3.2"], probeVector: [1, 0, 0, 0], contentHash: "ha" }),
    "src-drift": src({ sourceId: "src-drift", fileName: "drift.md", nodeIds: ["3.2"], probeVector: [0, 0, 0, 1], contentHash: "hd" }),
    "src-dup1": src({ sourceId: "src-dup1", fileName: "dup1.md", nodeIds: ["u-x"], probeVector: [0, 1, 0, 0], contentHash: "h1" }),
    "src-dup2": src({ sourceId: "src-dup2", fileName: "dup2.md", nodeIds: ["u-x"], probeVector: [0, 1, 0, 0], contentHash: "h2" }),
    "src-stale": src({ sourceId: "src-stale", fileName: "stale.md", nodeIds: ["u-y"], probeVector: [0, 0, 1, 0], contentHash: "hs", addedAt: OLD }),
  };
  manifest.counts = { sources: 5, passages: 5 };
  store.saveManifest(BRAIN, manifest);

  const graph: BrainGraph = {
    userNodes: {
      "u-x": { id: "u-x", title: "Fed topic", createdAt: RECENT },
      "u-orphan": { id: "u-orphan", title: "Orphan topic", createdAt: RECENT },
    },
    edges: [
      { sourceId: "src-a", nodeId: "3.2", passageCount: 1 },
      { sourceId: "src-drift", nodeId: "3.2", passageCount: 1 },
      { sourceId: "src-dup1", nodeId: "u-x", passageCount: 1 },
      { sourceId: "src-dup2", nodeId: "u-x", passageCount: 1 },
      { sourceId: "src-stale", nodeId: "u-y", passageCount: 1 },
    ],
    crossLinks: [],
    nodeSummaries: {},
  };
  saveGraph(store, BRAIN, graph);
}

function freshStore(): BrainStore {
  return createBrainStore(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-test-")));
}

describe("runLint: heuristic detectors", () => {
  it("flags near-duplicate, drift, stale, and orphan issues", async () => {
    const store = freshStore();
    seedBrain(store);
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-data-"));

    const report = await runLint(BRAIN, {
      store,
      embedder: new FakeEmbedder(),
      dataDir,
      now: NOW,
    });
    const types = new Set(report.findings.map((f) => f.type));

    expect(types.has("near_duplicate_sources")).toBe(true);
    expect(types.has("off_topic_drift")).toBe(true);
    expect(types.has("stale_source")).toBe(true);
    expect(types.has("orphan_node")).toBe(true);

    // src-a is genuinely on-topic for 3.2 → must NOT be flagged as drift.
    const drift = report.findings.find((f) => f.type === "off_topic_drift");
    expect(drift!.sourceIds).toEqual(["src-drift"]);

    // The near-dup pair is exactly src-dup1 + src-dup2.
    const dup = report.findings.find((f) => f.type === "near_duplicate_sources");
    expect(new Set(dup!.sourceIds)).toEqual(new Set(["src-dup1", "src-dup2"]));
  });

  it("resets the cadence counter and stamps lastLintAt", async () => {
    const store = freshStore();
    seedBrain(store);
    const manifest = store.loadManifest(BRAIN)!;
    manifest.lint.appendsSinceLint = 7;
    store.saveManifest(BRAIN, manifest);

    await runLint(BRAIN, {
      store,
      embedder: new FakeEmbedder(),
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-data2-")),
      now: NOW,
    });
    const after = store.loadManifest(BRAIN)!;
    expect(after.lint.appendsSinceLint).toBe(0);
    expect(after.lint.lastLintAt).toBe(NOW.toISOString());
  });
});

describe("applyFinding", () => {
  it("auto-applies an orphan-node removal from the graph", async () => {
    const store = freshStore();
    seedBrain(store);
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-data3-"));
    await runLint(BRAIN, { store, embedder: new FakeEmbedder(), dataDir, now: NOW });

    const res = await applyFinding(BRAIN, "orphan_node:u-orphan", "apply", { store });
    expect(res).toEqual({ ok: true, applied: true });

    const { loadGraph } = await import("@/lib/brain/weave");
    expect(loadGraph(BRAIN, { store }).userNodes["u-orphan"]).toBeUndefined();
    expect(loadLintReport(BRAIN, { store })!.applied).toContain("orphan_node:u-orphan");
  });

  it("records a dismissal without changing the graph", async () => {
    const store = freshStore();
    seedBrain(store);
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-data4-"));
    await runLint(BRAIN, { store, embedder: new FakeEmbedder(), dataDir, now: NOW });

    const res = await applyFinding(BRAIN, "near_duplicate_sources:src-dup1:src-dup2", "dismiss", {
      store,
    });
    expect(res).toEqual({ ok: true, applied: false });
    expect(loadLintReport(BRAIN, { store })!.dismissed).toContain(
      "near_duplicate_sources:src-dup1:src-dup2"
    );
  });

  it("returns not-ok for an unknown finding id", async () => {
    const store = freshStore();
    seedBrain(store);
    await runLint(BRAIN, {
      store,
      embedder: new FakeEmbedder(),
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-data5-")),
      now: NOW,
    });
    const res = await applyFinding(BRAIN, "does-not-exist", "apply", { store });
    expect(res.ok).toBe(false);
  });
});

describe("pruneBrains", () => {
  it("dry-run lists stale brains without deleting; --apply deletes them", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-prune-test-"));
    const store = createBrainStore(root);
    const staleId = "bbbbbbbb-1111-2222-3333-444444444444";
    const freshId = "cccccccc-1111-2222-3333-444444444444";
    store.createBrain(staleId);
    store.createBrain(freshId);

    // Age the stale brain's dir + files 40 days back.
    const staleDir = path.join(root, staleId);
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    for (const entry of ["", ...fs.readdirSync(staleDir)]) {
      const p = entry ? path.join(staleDir, entry) : staleDir;
      fs.utimesSync(p, old, old);
    }

    const dry = pruneBrains(root, 30, false);
    expect(dry.stale).toContain(staleId);
    expect(dry.deleted).toEqual([]);
    expect(fs.existsSync(staleDir)).toBe(true);

    const applied = pruneBrains(root, 30, true);
    expect(applied.deleted).toContain(staleId);
    expect(fs.existsSync(staleDir)).toBe(false);
    expect(fs.existsSync(path.join(root, freshId))).toBe(true);
  });
});
