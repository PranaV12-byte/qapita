import { describe, it, expect } from "vitest";
import { retrieveWith, type Stores } from "@/lib/rag/retriever";
import { FlatVectorStore } from "@/lib/rag/vectorStore";
import { buildLexicalIndex } from "@/lib/rag/lexical";
import { cosineSimilarity } from "@/lib/rag/cosine";
import type { Embedder, IndexEntry, Reranker } from "@/lib/rag/types";

// ── Deterministic fakes (no model downloads) ─────────────────────────────────────

class FakeEmbedder implements Embedder {
  readonly id = "fake";
  readonly dim = 4;
  constructor(private readonly queryMap: Record<string, number[]>) {}
  async embedQuery(text: string): Promise<Float32Array> {
    return Float32Array.from(this.queryMap[text] ?? [0, 0, 0, 0]);
  }
  async embedPassage(): Promise<Float32Array> {
    return new Float32Array(this.dim);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    return texts.map(() => new Float32Array(this.dim));
  }
}

/** Reranker that scores docs containing `needle` high, everything else low. */
class NeedleReranker implements Reranker {
  readonly id = "needle";
  constructor(private readonly needle: string) {}
  async rerank(_query: string, docs: string[]): Promise<number[]> {
    return docs.map((d) => (d.includes(this.needle) ? 10 : -10));
  }
}

function makeStores(entries: IndexEntry[], rows: number[][]): Stores {
  const dim = rows[0].length;
  const flat = new Float32Array(entries.length * dim);
  rows.forEach((r, i) => flat.set(Float32Array.from(r), i * dim));
  const store = new FlatVectorStore(flat, dim);
  const scenarioVecs = entries.flatMap((e, i) =>
    e.isScenario
      ? [{ scenarioId: e.scenarioId, label: e.label, vector: store.row(i) }]
      : []
  );
  return {
    entries,
    store,
    lexical: buildLexicalIndex(entries),
    parents: {},
    scenarioVecs,
  };
}

// Shared corpus: A carries the exact identifier "Form 3921"; B is the semantic
// decoy the bi-encoder prefers; C is about RSUs; plus one scenario entry.
const CORPUS: IndexEntry[] = [
  {
    tier: "curated",
    nodeId: "3.4",
    text: "Form 3921 is filed by the corporation to report ISO exercises to the IRS.",
    isScenario: false,
  },
  {
    tier: "curated",
    nodeId: "1.1",
    text: "Incentive stock options are a tax-advantaged equity award.",
    isScenario: false,
  },
  {
    tier: "curated",
    nodeId: "3.2",
    text: "Restricted stock units are taxed as ordinary income at vesting.",
    isScenario: false,
  },
  {
    tier: "curated",
    isScenario: true,
    scenarioId: "rsu-vesting-tax",
    label: "How RSU vesting and tax withholding work",
    text: "rsu vesting tax withholding",
  },
];
const CORPUS_VECS = [
  [0, 1, 0, 0], // A
  [1, 0, 0, 0], // B (decoy — dense will prefer this for the Form 3921 query)
  [0.5, 0.5, 0, 0], // C
  [0, 0, 1, 0], // scenario
];

describe("retrieveWith — hybrid fusion", () => {
  it("dense alone prefers the decoy, but lexical fusion surfaces the exact-identifier chunk", async () => {
    const embedder = new FakeEmbedder({
      "What is Form 3921?": [0.9, 0.1, 0, 0],
    });
    // Sanity: pure dense would rank the decoy (B) above the correct chunk (A).
    const q = await embedder.embedQuery("What is Form 3921?");
    expect(cosineSimilarity(q, Float32Array.from([1, 0, 0, 0]))).toBeGreaterThan(
      cosineSimilarity(q, Float32Array.from([0, 1, 0, 0]))
    );

    const stores = makeStores(CORPUS, CORPUS_VECS);
    const res = await retrieveWith("What is Form 3921?", stores, {
      embedder,
      rerank: false,
    });
    expect(res.chunks[0].nodeId).toBe("3.4"); // A wins after fusion
  });
});

describe("retrieveWith — rerank", () => {
  it("cross-encoder score reorders the fused pool", async () => {
    const embedder = new FakeEmbedder({
      "What is Form 3921?": [0.9, 0.1, 0, 0],
    });
    const stores = makeStores(CORPUS, CORPUS_VECS);
    const res = await retrieveWith("What is Form 3921?", stores, {
      embedder,
      rerank: true,
      reranker: new NeedleReranker("Restricted stock units"),
    });
    expect(res.chunks[0].nodeId).toBe("3.2"); // reranker promoted the RSU chunk
  });
});

describe("retrieveWith — hard node filter", () => {
  it("restricts candidates to the requested node", async () => {
    const embedder = new FakeEmbedder({
      "incentive stock options": [1, 0, 0, 0],
    });
    const stores = makeStores(CORPUS, CORPUS_VECS);
    const res = await retrieveWith("incentive stock options", stores, {
      embedder,
      rerank: false,
      filterToNode: "1.1",
    });
    res.chunks.forEach((c) => expect(c.nodeId).toBe("1.1"));
  });
});

describe("retrieveWith — scrape dedup", () => {
  it("drops a near-duplicate scrape chunk", async () => {
    const entries: IndexEntry[] = [
      { tier: "scrape", nodeId: "general", text: "alpha grounding one", isScenario: false },
      { tier: "scrape", nodeId: "general", text: "alpha grounding two", isScenario: false },
      { tier: "curated", nodeId: "1.1", text: "alpha curated", isScenario: false },
    ];
    const vecs = [
      [1, 0, 0, 0],
      [1, 0, 0, 0], // identical to the first scrape chunk
      [1, 0, 0, 0],
    ];
    const stores = makeStores(entries, vecs);
    const embedder = new FakeEmbedder({ alpha: [1, 0, 0, 0] });
    const res = await retrieveWith("alpha", stores, { embedder, rerank: false });
    const scrape = res.chunks.filter((c) => c.tier === "scrape").length;
    expect(scrape).toBe(1);
  });
});

describe("retrieveWith — fallback", () => {
  it("triggers on an off-topic query and returns the nearest scenario", async () => {
    const embedder = new FakeEmbedder({
      "totally unrelated cooking recipe": [0, 0, 0.2, 1],
    });
    const stores = makeStores(CORPUS, CORPUS_VECS);
    const res = await retrieveWith("totally unrelated cooking recipe", stores, {
      embedder,
      rerank: false,
    });
    expect(res.fallbackUsed).toBe(true);
    expect(res.fallbackScenario?.id).toBe("rsu-vesting-tax");
  });
});
