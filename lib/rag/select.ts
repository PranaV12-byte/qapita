import { cosineSimilarity } from "./cosine";
import type { Tier } from "./types";

export type Candidate = {
  index: number;
  tier: Tier;
  score: number;
  cosine: number;
};

export type SelectOpts = {
  topK: number;
  scrapeCap: number;
  /** Skip a scrape candidate if cosine to an already-selected scrape vec exceeds this. */
  dedupThreshold?: number;
  /** Vector lookup for dedup; omit to disable dedup. */
  getVector?: (index: number) => Float32Array;
};

/**
 * Greedy final selection over score-sorted candidates:
 * fill up to `topK`, allow at most `scrapeCap` scrape-tier chunks, and skip a
 * scrape chunk that near-duplicates an already-selected scrape chunk (so the
 * scrape slots carry diverse grounding, not the same fact from N sources).
 * Curated chunks are never deduped or capped. Pure — no I/O.
 */
export function selectResults(
  candidates: Candidate[],
  opts: SelectOpts
): Candidate[] {
  const { topK, scrapeCap, dedupThreshold, getVector } = opts;
  const selected: Candidate[] = [];
  const selectedScrapeVecs: Float32Array[] = [];
  let scrapeCount = 0;

  for (const c of candidates) {
    if (selected.length >= topK) break;

    if (c.tier === "scrape") {
      if (scrapeCount >= scrapeCap) continue;
      if (dedupThreshold !== undefined && getVector) {
        const v = getVector(c.index);
        const isDup = selectedScrapeVecs.some(
          (sv) => cosineSimilarity(v, sv) > dedupThreshold
        );
        if (isDup) continue;
        selectedScrapeVecs.push(v);
      }
      scrapeCount++;
    }

    selected.push(c);
  }

  return selected;
}
