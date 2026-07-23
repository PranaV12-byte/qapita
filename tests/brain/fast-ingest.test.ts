// V0 (SPEC-VAULT §3) — the single-pass ingest guarantees:
//  1. Feeding weave precomputed chunk vectors produces a delta byte-identical
//     to letting weave chunk + embed internally (the vectors↔chunks alignment
//     invariant is preserved; the fast path changes *when* we embed, not *what*).
//  2. Re-embedding identical inputs through the shared EmbedCache costs zero
//     embedder calls.
//  3. Block embedding reports real progress that reaches (total, total).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chunkMarkdown } from "@/lib/rag/chunker";
import { buildEmbedInput } from "@/scripts/ingest/contextualize";
import { EmbedCache, embedInBlocks } from "@/lib/rag/embedder";
import { createBrainStore, type BrainStore } from "@/lib/brain/store";
import { weaveSource, type PlacementPlan } from "@/lib/brain/weave";
import type { Embedder, ChunkMeta } from "@/lib/rag/types";

class CountingFakeEmbedder implements Embedder {
  readonly id = "fake-fast-ingest";
  readonly dim = 4;
  calls = 0;
  async embedQuery(): Promise<Float32Array> {
    return new Float32Array(this.dim);
  }
  async embedPassage(text: string): Promise<Float32Array> {
    this.calls++;
    return this.vec(text);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    this.calls += texts.length;
    return texts.map((t) => this.vec(t));
  }
  private vec(text: string): Float32Array {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return Float32Array.from([
      (h % 97) / 97,
      ((h >>> 5) % 97) / 97,
      ((h >>> 11) % 97) / 97,
      ((h >>> 17) % 97) / 97,
    ]);
  }
}

function freshStore(): BrainStore {
  return createBrainStore(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-fast-ingest-")));
}

function tmpFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-embed-cache-")), "cache.json");
}

const BRAIN = "22222222-2222-2222-2222-222222222222";

// Long enough (two sections, each body > CHUNK_MAX_CHARS) to produce several
// chunks across more than one embed block.
const DOC = [
  "# Fast ingest doc",
  "",
  "## Vesting",
  "",
  "Restricted stock units vest on a schedule set by the plan. ".repeat(12),
  "",
  "A cliff delays the first tranche; graded vesting spreads the rest. ".repeat(12),
  "",
  "## Taxation",
  "",
  "Incentive stock options can trigger the alternative minimum tax at exercise. ".repeat(12),
  "",
  "Ordinary income and capital gains treatment depend on holding periods. ".repeat(12),
].join("\n");

function readDelta(store: BrainStore, brainId: string) {
  const { dir } = store.brainPaths(brainId);
  const entries = JSON.parse(fs.readFileSync(path.join(dir, "chunks.json"), "utf-8")) as ChunkMeta[];
  const buf = fs.readFileSync(path.join(dir, "vectors.bin"));
  const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return { entries, vectors };
}

describe("V0 fast ingest: precomputed weave == internal-embed weave", () => {
  it("produces a byte-identical delta whether weave embeds internally or reuses precomputed vectors", async () => {
    const embedder = new CountingFakeEmbedder();
    const sourceId = "s-fast";
    const { chunks, sections, title: chunkedTitle } = chunkMarkdown(DOC, {
      docId: sourceId,
      title: "Fast",
    });
    expect(chunks.length).toBeGreaterThan(1);

    const inputs: string[] = [];
    for (const c of chunks) inputs.push(await buildEmbedInput(chunkedTitle, c.headingPath, c.text));
    const chunkVecs = await embedInBlocks(null, embedder, inputs, 16);

    const plan: PlacementPlan = { sectionNodeIds: sections.map(() => "3.2"), newNodes: [] };
    const base = {
      brainId: BRAIN,
      sourceId,
      fileName: "fast.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC),
      title: "Fast",
      markdown: DOC,
      plan,
      contentHash: "hf",
      probeVector: new Float32Array(4),
      embedder,
    };

    const legacyStore = freshStore();
    await weaveSource({ ...base, store: legacyStore });

    const fastStore = freshStore();
    await weaveSource({
      ...base,
      store: fastStore,
      precomputed: { chunks, sections, chunkedTitle, chunkVecs },
    });

    const legacy = readDelta(legacyStore, BRAIN);
    const fast = readDelta(fastStore, BRAIN);
    expect(fast.entries).toEqual(legacy.entries);
    expect(Array.from(fast.vectors)).toEqual(Array.from(legacy.vectors));
  });
});

describe("V0 fast ingest: EmbedCache reuse", () => {
  it("re-embedding identical inputs costs zero embedder calls", async () => {
    const embedder = new CountingFakeEmbedder();
    const cache = new EmbedCache(tmpFile());
    const texts = ["alpha passage", "beta passage", "gamma passage"];

    await embedInBlocks(cache, embedder, texts, 16);
    const afterFirst = embedder.calls;
    expect(afterFirst).toBe(3);

    await embedInBlocks(cache, embedder, texts, 16);
    expect(embedder.calls).toBe(afterFirst); // all hits → no new embedder calls
    expect(cache.stats().hits).toBe(3);
  });
});

describe("V0 fast ingest: block progress", () => {
  it("reports monotonic progress that reaches (total, total)", async () => {
    const embedder = new CountingFakeEmbedder();
    const seen: Array<[number, number]> = [];
    await embedInBlocks(null, embedder, ["a", "b", "c", "d", "e"], 2, (c, t) => seen.push([c, t]));
    expect(seen.map((p) => p[0])).toEqual([2, 4, 5]);
    expect(seen[seen.length - 1]).toEqual([5, 5]);
  });

  it("reports (0, 0) exactly once for empty input", async () => {
    const embedder = new CountingFakeEmbedder();
    const seen: Array<[number, number]> = [];
    const out = await embedInBlocks(null, embedder, [], 16, (c, t) => seen.push([c, t]));
    expect(out).toEqual([]);
    expect(seen).toEqual([[0, 0]]);
  });
});
