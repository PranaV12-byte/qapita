import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeGraphModel } from "@/lib/brain/graph";
import { saveGraph, type BrainGraph } from "@/lib/brain/weave";
import { createBrainStore, type BrainStore, type BrainManifest } from "@/lib/brain/store";

const BRAIN = "dddddddd-1111-2222-3333-444444444444";

function freshStore(): BrainStore {
  return createBrainStore(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-graph-test-")));
}

describe("composeGraphModel: foundation", () => {
  it("always includes 7 pillars + 41 topics + 1 general, with pillar→topic tree edges", () => {
    const model = composeGraphModel(null);
    expect(model.nodes.filter((n) => n.kind === "pillar")).toHaveLength(7);
    expect(model.nodes.filter((n) => n.kind === "topic")).toHaveLength(41);
    expect(model.nodes.filter((n) => n.kind === "general")).toHaveLength(1);
    expect(model.edges.filter((e) => e.kind === "tree")).toHaveLength(41);
    expect(model.hasUserContent).toBe(false);
  });

  it("adds curated related edges supplied by the caller (deduped, valid endpoints only)", () => {
    const model = composeGraphModel(null, {
      relatedTreeEdges: [
        { a: "1.1", b: "3.1" },
        { a: "3.1", b: "1.1" }, // reverse dup — must collapse
        { a: "1.1", b: "does-not-exist" }, // dropped
      ],
    });
    expect(model.edges.filter((e) => e.kind === "related")).toHaveLength(1);
  });
});

describe("composeGraphModel: layout determinism", () => {
  it("produces identical positions across calls (no RNG)", () => {
    const a = composeGraphModel(null);
    const b = composeGraphModel(null);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });
});

describe("composeGraphModel: brain overlay + backlinks", () => {
  function seed(store: BrainStore): void {
    store.createBrain(BRAIN);
    const manifest = store.loadManifest(BRAIN) as BrainManifest;
    manifest.sources = {
      "src-1": {
        sourceId: "src-1",
        fileName: "notes.md",
        format: "markdown",
        addedAt: new Date("2026-07-20").toISOString(),
        nodeIds: ["3.2", "u-novel"],
        passageCount: 4,
        contentHash: "h1",
        probeVector: [1, 0, 0, 0],
      },
    };
    manifest.counts = { sources: 1, passages: 4 };
    store.saveManifest(BRAIN, manifest);

    const graph: BrainGraph = {
      userNodes: { "u-novel": { id: "u-novel", title: "Novel Topic", createdAt: "2026-07-20" } },
      edges: [
        { sourceId: "src-1", nodeId: "3.2", passageCount: 3 },
        { sourceId: "src-1", nodeId: "u-novel", passageCount: 1 },
      ],
      crossLinks: [{ a: "3.2", b: "u-novel" }],
      nodeSummaries: { "u-novel": "A novel topic summary.", "3.2": "RSU tax summary." },
    };
    saveGraph(store, BRAIN, graph);

    // One logged answer that cited both the topic 3.2 and the source src-1.
    store.appendAnswer(BRAIN, {
      artifactId: "a1",
      query: "how are my RSUs taxed",
      title: "RSU tax",
      citations: [
        { kind: "topic", nodeId: "3.2", title: "RSU & ESPP tax" },
        { kind: "source", sourceId: "src-1", title: "notes.md" },
      ],
      ts: new Date("2026-07-21").toISOString(),
    });
  }

  it("adds the user-node, the source satellite, and weave edges", () => {
    const store = freshStore();
    seed(store);
    const model = composeGraphModel(BRAIN, { store });

    expect(model.hasUserContent).toBe(true);
    expect(model.nodes.find((n) => n.id === "u-novel")?.kind).toBe("user-node");
    const source = model.nodes.find((n) => n.id === "source:src-1");
    expect(source?.kind).toBe("source");
    expect(new Set(source?.feedsNodeIds)).toEqual(new Set(["3.2", "u-novel"]));
    expect(model.edges.filter((e) => e.kind === "weave")).toHaveLength(2);
    // crossLink 3.2↔u-novel surfaces as a related edge.
    expect(model.edges.some((e) => e.kind === "related")).toBe(true);
  });

  it("computes backlink counts from answers.jsonl (a node/source cited by an answer)", () => {
    const store = freshStore();
    seed(store);
    const model = composeGraphModel(BRAIN, { store });

    expect(model.nodes.find((n) => n.id === "3.2")?.citedByAnswers).toBe(1);
    expect(model.nodes.find((n) => n.id === "source:src-1")?.citedByAnswers).toBe(1);
    // The source's node summary flowed onto the topic node too.
    expect(model.nodes.find((n) => n.id === "3.2")?.summary).toBe("RSU tax summary.");
    expect(model.nodes.find((n) => n.id === "u-novel")?.summary).toBe("A novel topic summary.");
  });

  it("stays deterministic with a brain overlay too", () => {
    const store = freshStore();
    seed(store);
    const a = composeGraphModel(BRAIN, { store });
    const b = composeGraphModel(BRAIN, { store });
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });
});
