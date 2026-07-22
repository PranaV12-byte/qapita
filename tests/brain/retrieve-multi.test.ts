import { describe, it, expect } from "vitest";
import { retrieveWith, retrieveMulti, type Stores } from "@/lib/rag/retriever";
import { FlatVectorStore } from "@/lib/rag/vectorStore";
import { buildLexicalIndex } from "@/lib/rag/lexical";
import type { Embedder, IndexEntry } from "@/lib/rag/types";

// Deterministic fake: maps a text substring -> vector; unmapped -> zero vector
// (cosine 0, per cosine.ts). 4-dim, same pattern as tests/rag/retriever.test.ts.
class FakeEmbedder implements Embedder {
  readonly id = "fake-multi";
  readonly dim = 4;
  constructor(private readonly map: Record<string, number[]>) {}
  private vec(text: string): Float32Array {
    for (const [k, v] of Object.entries(this.map)) if (text.includes(k)) return Float32Array.from(v);
    return new Float32Array(this.dim);
  }
  async embedQuery(t: string): Promise<Float32Array> {
    return this.vec(t);
  }
  async embedPassage(t: string): Promise<Float32Array> {
    return this.vec(t);
  }
  async embedPassages(ts: string[]): Promise<Float32Array[]> {
    return ts.map((t) => this.vec(t));
  }
}

function makeStores(entries: IndexEntry[], rows: number[][]): Stores {
  const dim = rows[0]?.length ?? 4;
  const flat = new Float32Array(entries.length * dim);
  rows.forEach((r, i) => flat.set(Float32Array.from(r), i * dim));
  const store = new FlatVectorStore(flat, dim);
  const scenarioVecs = entries.flatMap((e, i) =>
    e.isScenario ? [{ scenarioId: e.scenarioId, label: e.label, vector: store.row(i) }] : []
  );
  return { entries, store, lexical: buildLexicalIndex(entries), parents: {}, scenarioVecs };
}

const FOUNDATION: IndexEntry[] = [
  { tier: "curated", nodeId: "1.1", text: "Incentive stock options are tax-advantaged.", isScenario: false },
  { tier: "curated", nodeId: "3.2", text: "RSUs are taxed as ordinary income at vesting.", isScenario: false },
  {
    tier: "curated",
    isScenario: true,
    scenarioId: "rsu-vesting-tax",
    label: "How RSU vesting and tax withholding work",
    text: "rsu vesting tax",
  },
];
const FOUNDATION_VECS = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
];

describe("retrieveMulti — empty brain is byte-identical to retrieveWith (regression)", () => {
  it("a single-store retrieveMulti equals retrieveWith for the same query", async () => {
    const embedder = new FakeEmbedder({ "how are RSUs taxed": [0, 1, 0, 0] });
    const foundation = makeStores(FOUNDATION, FOUNDATION_VECS);

    const single = await retrieveWith("how are RSUs taxed", foundation, { embedder, rerank: false });
    const multi = await retrieveMulti("how are RSUs taxed", [foundation], {
      embedder,
      rerank: false,
      graphExpansion: false,
    });

    expect(multi.chunks.map((c) => c.text)).toEqual(single.chunks.map((c) => c.text));
    expect(multi.chunks.map((c) => c.nodeId)).toEqual(single.chunks.map((c) => c.nodeId));
    expect(multi.fallbackUsed).toBe(single.fallbackUsed);
  });
});

describe("retrieveMulti — user delta composes into the one wiki", () => {
  const brainDelta = () =>
    makeStores(
      [
        {
          tier: "user",
          nodeId: "3.2",
          sourceId: "src-1",
          title: "my-notes.md",
          text: "UNIQUE_UPLOAD_MARKER: my employer withholds 40% on RSU vesting.",
          isScenario: false,
          parentId: "src-1#0",
        },
      ],
      [[0, 0, 0, 1]]
    );

  it("a query only the upload answers surfaces the user chunk", async () => {
    const embedder = new FakeEmbedder({ "what does my employer withhold": [0, 0, 0, 1] });
    const foundation = makeStores(FOUNDATION, FOUNDATION_VECS);

    const res = await retrieveMulti("what does my employer withhold", [foundation, brainDelta()], {
      embedder,
      rerank: false,
      graphExpansion: false,
    });
    const userChunks = res.chunks.filter((c) => c.tier === "user");
    expect(userChunks.length).toBeGreaterThan(0);
    expect(userChunks[0].sourceId).toBe("src-1");
    expect(userChunks[0].text).toContain("UNIQUE_UPLOAD_MARKER");
  });

  it("the foundation still answers a foundation-covered query when a brain is present", async () => {
    const embedder = new FakeEmbedder({ "incentive stock options": [1, 0, 0, 0] });
    const foundation = makeStores(FOUNDATION, FOUNDATION_VECS);
    const res = await retrieveMulti("incentive stock options", [foundation, brainDelta()], {
      embedder,
      rerank: false,
      graphExpansion: false,
    });
    expect(res.chunks.some((c) => c.nodeId === "1.1")).toBe(true);
  });
});

describe("retrieveMulti — neighbour expansion", () => {
  it("pulls in a pillar-sibling passage as a neighbor, respecting the limit", async () => {
    // Two foundation nodes in the SAME pillar (1.1, 1.2 → 'awards'). The query
    // hits 1.1 directly; 1.2 should arrive as a neighbor (same pillar).
    const entries: IndexEntry[] = [
      { tier: "curated", nodeId: "1.1", text: "ISO direct hit alpha.", isScenario: false, parentId: "c#0" },
      { tier: "curated", nodeId: "1.2", text: "NSO sibling alpha content.", isScenario: false, parentId: "c#1" },
    ];
    const vecs = [
      [1, 0, 0, 0],
      [0.9, 0.1, 0, 0], // high cosine to the query, so it clears the gate
    ];
    const foundation = makeStores(entries, vecs);
    const embedder = new FakeEmbedder({ alpha: [1, 0, 0, 0] });

    const withExp = await retrieveMulti("alpha", [foundation], {
      embedder,
      rerank: false,
      graphExpansion: true,
      neighborLimit: 4,
      topK: 1, // force 1.2 out of the primary hits so expansion is what pulls it in
    });
    const neighbors = withExp.chunks.filter((c) => c.neighbor);
    expect(neighbors.some((c) => c.nodeId === "1.2")).toBe(true);

    const noExp = await retrieveMulti("alpha", [foundation], {
      embedder,
      rerank: false,
      graphExpansion: false,
      topK: 1,
    });
    expect(noExp.chunks.some((c) => c.neighbor)).toBe(false);
  });

  it("respects neighborLimit=0 (no neighbours added)", async () => {
    const entries: IndexEntry[] = [
      { tier: "curated", nodeId: "1.1", text: "alpha one", isScenario: false, parentId: "c#0" },
      { tier: "curated", nodeId: "1.2", text: "alpha two", isScenario: false, parentId: "c#1" },
    ];
    const foundation = makeStores(entries, [[1, 0, 0, 0], [0.9, 0.1, 0, 0]]);
    const embedder = new FakeEmbedder({ alpha: [1, 0, 0, 0] });
    const res = await retrieveMulti("alpha", [foundation], {
      embedder,
      rerank: false,
      graphExpansion: true,
      neighborLimit: 0,
      topK: 1,
    });
    expect(res.chunks.some((c) => c.neighbor)).toBe(false);
  });
});
