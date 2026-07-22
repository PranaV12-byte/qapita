// TDD: written against the not-yet-existing lib/brain/weave.ts. The one
// invariant that matters most in this whole feature (SPEC-BRAIN.md Sec2.4):
// delta vectors.bin row i <-> chunks.json[i] <-> lexical doc id i, always,
// through appends, removals, and concurrent writes to the same brain.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chunkMarkdown } from "@/lib/rag/chunker";
import { loadLexicalIndex } from "@/lib/rag/lexical";
import { createBrainStore, type BrainStore } from "@/lib/brain/store";
import type { Embedder, ChunkMeta } from "@/lib/rag/types";
import { weaveSource, removeSource, loadGraph, type PlacementPlan } from "@/lib/brain/weave";

class FakeEmbedder implements Embedder {
  readonly id = "fake-weave";
  readonly dim = 4;
  async embedQuery(): Promise<Float32Array> {
    return new Float32Array(this.dim);
  }
  async embedPassage(text: string): Promise<Float32Array> {
    return this.vec(text);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.vec(t));
  }
  private vec(text: string): Float32Array {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return Float32Array.from([(h % 97) / 97, ((h >>> 5) % 97) / 97, 0, 0]);
  }
}
const embedder = new FakeEmbedder();

function freshStore(): BrainStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-weave-test-"));
  return createBrainStore(dir);
}

const BRAIN_A = "11111111-1111-1111-1111-111111111111";

function planFor(markdown: string, nodeId: string): PlacementPlan {
  const { sections } = chunkMarkdown(markdown, { title: "Test doc" });
  return { sectionNodeIds: sections.map(() => nodeId), newNodes: [] };
}

const DOC_A =
  "# Doc A\n\nContent about restricted stock units and vesting schedules for employees.";
const DOC_B =
  "# Doc B\n\nContent about incentive stock options and the alternative minimum tax.";

type Delta = {
  entries: ChunkMeta[];
  vectors: Float32Array;
  parents: Record<string, { parentId: string }>;
  lexical: ReturnType<typeof loadLexicalIndex>;
};

function readDelta(store: BrainStore, brainId: string): Delta {
  const { dir } = store.brainPaths(brainId);
  const entries = JSON.parse(
    fs.readFileSync(path.join(dir, "chunks.json"), "utf-8")
  ) as ChunkMeta[];
  const vecBuf = fs.readFileSync(path.join(dir, "vectors.bin"));
  const vectors = new Float32Array(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength / 4);
  const parents = JSON.parse(fs.readFileSync(path.join(dir, "parents.json"), "utf-8"));
  const lexical = loadLexicalIndex(
    fs.readFileSync(path.join(dir, "lexical-index.json"), "utf-8")
  );
  return { entries, vectors, parents, lexical };
}

function assertAligned(delta: Delta): void {
  const dim = delta.entries.length > 0 ? delta.vectors.length / delta.entries.length : 0;
  expect(Number.isInteger(dim)).toBe(true);
  expect(delta.vectors.length).toBe(delta.entries.length * dim);
  expect(delta.lexical.documentCount).toBe(delta.entries.length);
  for (const e of delta.entries) {
    expect(e.parentId).toBeTruthy();
    expect(delta.parents[e.parentId!]).toBeDefined();
  }
}

describe("weave alignment invariants", () => {
  it("a single append leaves vectors/chunks/lexical aligned and parentIds resolving", async () => {
    const store = freshStore();
    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s1",
      fileName: "doc-a.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_A),
      title: "Doc A",
      markdown: DOC_A,
      plan: planFor(DOC_A, "3.2"),
      contentHash: "hash-a",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const delta = readDelta(store, BRAIN_A);
    assertAligned(delta);
    expect(delta.entries.length).toBeGreaterThan(0);
    expect(delta.entries.every((e) => e.tier === "user" && e.sourceId === "s1")).toBe(true);
  });

  it("two sequential appends keep alignment, growing append-only (old rows untouched)", async () => {
    const store = freshStore();
    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s1",
      fileName: "a.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_A),
      title: "A",
      markdown: DOC_A,
      plan: planFor(DOC_A, "3.2"),
      contentHash: "h1",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const afterFirst = readDelta(store, BRAIN_A);

    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s2",
      fileName: "b.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_B),
      title: "B",
      markdown: DOC_B,
      plan: planFor(DOC_B, "1.1"),
      contentHash: "h2",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const afterSecond = readDelta(store, BRAIN_A);

    assertAligned(afterSecond);
    expect(afterSecond.entries.length).toBeGreaterThan(afterFirst.entries.length);
    for (let i = 0; i < afterFirst.entries.length; i++) {
      expect(afterSecond.entries[i].text).toBe(afterFirst.entries[i].text);
    }
  });

  it("removing a source keeps alignment and drops exactly its chunks", async () => {
    const store = freshStore();
    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s1",
      fileName: "a.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_A),
      title: "A",
      markdown: DOC_A,
      plan: planFor(DOC_A, "3.2"),
      contentHash: "h1",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s2",
      fileName: "b.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_B),
      title: "B",
      markdown: DOC_B,
      plan: planFor(DOC_B, "1.1"),
      contentHash: "h2",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const before = readDelta(store, BRAIN_A);
    const s1Count = before.entries.filter((e) => e.sourceId === "s1").length;
    expect(s1Count).toBeGreaterThan(0);

    await removeSource(BRAIN_A, "s1", { store });
    const after = readDelta(store, BRAIN_A);
    assertAligned(after);
    expect(after.entries.length).toBe(before.entries.length - s1Count);
    expect(after.entries.every((e) => e.sourceId !== "s1")).toBe(true);
    expect(after.entries.some((e) => e.sourceId === "s2")).toBe(true);
  });

  it("concurrent double-upload to the same brain serializes without corrupting alignment", async () => {
    const store = freshStore();
    const p1 = weaveSource({
      brainId: BRAIN_A,
      sourceId: "c1",
      fileName: "a.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_A),
      title: "A",
      markdown: DOC_A,
      plan: planFor(DOC_A, "3.2"),
      contentHash: "h1",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const p2 = weaveSource({
      brainId: BRAIN_A,
      sourceId: "c2",
      fileName: "b.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC_B),
      title: "B",
      markdown: DOC_B,
      plan: planFor(DOC_B, "1.1"),
      contentHash: "h2",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    const [r1, r2] = await Promise.all([p1, p2]);

    const delta = readDelta(store, BRAIN_A);
    assertAligned(delta);
    expect(delta.entries.length).toBe(r1.totalPassages + r2.totalPassages);
    expect(delta.entries.filter((e) => e.sourceId === "c1").length).toBe(r1.totalPassages);
    expect(delta.entries.filter((e) => e.sourceId === "c2").length).toBe(r2.totalPassages);
  });

  it("a plan proposing a new user-node creates it in graph.json and assigns matching chunks", async () => {
    const store = freshStore();
    const doc = "# Novel\n\nSomething genuinely new that matches no existing topic.";
    const plan: PlacementPlan = {
      sectionNodeIds: ["u-novel-topic"],
      newNodes: [{ id: "u-novel-topic", title: "Novel Topic" }],
    };
    const report = await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s-novel",
      fileName: "novel.md",
      format: "markdown",
      originalBuffer: Buffer.from(doc),
      title: "Novel",
      markdown: doc,
      plan,
      contentHash: "hn",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });
    expect(report.newNodes).toEqual([{ id: "u-novel-topic", title: "Novel Topic" }]);
    const graph = loadGraph(BRAIN_A, { store });
    expect(graph.userNodes["u-novel-topic"]).toBeDefined();
    const delta = readDelta(store, BRAIN_A);
    expect(delta.entries.every((e) => e.nodeId === "u-novel-topic")).toBe(true);
  });

  it("a duplicate new-node id proposal from a second doc resolves to a non-colliding id", async () => {
    const store = freshStore();
    const doc1 = "# Novel\n\nSomething genuinely new, round one.";
    await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s1",
      fileName: "a.md",
      format: "markdown",
      originalBuffer: Buffer.from(doc1),
      title: "Novel",
      markdown: doc1,
      plan: { sectionNodeIds: ["u-novel"], newNodes: [{ id: "u-novel", title: "Novel" }] },
      contentHash: "h1",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });

    const doc2 = "# Novel Again\n\nSomething genuinely new, round two, unrelated wording.";
    const report2 = await weaveSource({
      brainId: BRAIN_A,
      sourceId: "s2",
      fileName: "b.md",
      format: "markdown",
      originalBuffer: Buffer.from(doc2),
      title: "Novel Again",
      markdown: doc2,
      plan: { sectionNodeIds: ["u-novel"], newNodes: [{ id: "u-novel", title: "Novel Again" }] },
      contentHash: "h2",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });

    expect(report2.newNodes[0].id).not.toBe("u-novel");
    const graph = loadGraph(BRAIN_A, { store });
    expect(Object.keys(graph.userNodes).length).toBe(2);
  });
});
