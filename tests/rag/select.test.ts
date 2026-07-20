import { describe, it, expect } from "vitest";
import { selectResults, type Candidate } from "@/lib/rag/select";

function cand(index: number, tier: "curated" | "scrape", score: number): Candidate {
  return { index, tier, score, cosine: score };
}

describe("selectResults", () => {
  it("caps total results at topK", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      cand(i, "curated", 1 - i * 0.01)
    );
    const out = selectResults(candidates, { topK: 8, scrapeCap: 3 });
    expect(out.length).toBe(8);
  });

  it("allows at most scrapeCap scrape-tier results", () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => cand(i, "scrape", 1 - i * 0.01)),
      ...Array.from({ length: 10 }, (_, i) => cand(100 + i, "curated", 0.5 - i * 0.01)),
    ];
    const out = selectResults(candidates, { topK: 8, scrapeCap: 3 });
    const scrape = out.filter((c) => c.tier === "scrape").length;
    expect(scrape).toBeLessThanOrEqual(3);
  });

  it("skips near-duplicate scrape chunks without consuming a scrape slot", () => {
    // Three scrape candidates; two are identical vectors → one should be dropped.
    const vecs: Record<number, Float32Array> = {
      1: new Float32Array([1, 0, 0]),
      2: new Float32Array([1, 0, 0]), // dup of 1
      3: new Float32Array([0, 1, 0]), // distinct
    };
    const candidates = [
      cand(1, "scrape", 0.9),
      cand(2, "scrape", 0.8),
      cand(3, "scrape", 0.7),
    ];
    const out = selectResults(candidates, {
      topK: 8,
      scrapeCap: 3,
      dedupThreshold: 0.93,
      getVector: (i) => vecs[i],
    });
    const idx = out.map((c) => c.index);
    expect(idx).toContain(1);
    expect(idx).not.toContain(2); // near-duplicate dropped
    expect(idx).toContain(3); // distinct kept
  });

  it("never deduplicates or caps curated chunks", () => {
    const vecs = new Float32Array([1, 0, 0]);
    const candidates = Array.from({ length: 5 }, (_, i) =>
      cand(i, "curated", 1 - i * 0.01)
    );
    const out = selectResults(candidates, {
      topK: 8,
      scrapeCap: 3,
      dedupThreshold: 0.93,
      getVector: () => vecs, // identical vectors, but curated is exempt
    });
    expect(out.length).toBe(5);
  });
});
