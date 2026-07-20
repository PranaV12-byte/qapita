import MiniSearch from "minisearch";
import type { IndexEntry } from "./types";
import { RRF_K } from "./config";

// Construction options — MUST be identical when building and when reloading via
// MiniSearch.loadJSON, or the deserialized index misbehaves.
export const LEXICAL_OPTIONS = {
  fields: ["text", "headingPath", "title"],
  storeFields: [] as string[],
  idField: "id",
};

const SEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 0.2,
  combineWith: "OR" as const,
};

/**
 * Build a BM25 lexical index over content chunks. The MiniSearch doc `id` is the
 * chunk's position in the `entries` array, so search hits map straight back to
 * vectors/chunks. Scenario entries are excluded.
 */
export function buildLexicalIndex(entries: IndexEntry[]): MiniSearch {
  const ms = new MiniSearch(LEXICAL_OPTIONS);
  const docs: Array<{
    id: number;
    text: string;
    headingPath: string;
    title: string;
  }> = [];

  entries.forEach((e, i) => {
    if (e.isScenario) return;
    docs.push({
      id: i,
      text: e.text,
      headingPath: e.headingPath ?? "",
      title: e.title ?? "",
    });
  });

  ms.addAll(docs);
  return ms;
}

/** Reload a serialized lexical index produced by `ms.toJSON()`. */
export function loadLexicalIndex(json: string): MiniSearch {
  return MiniSearch.loadJSON(json, LEXICAL_OPTIONS);
}

/** Top-k lexical hits as `{ index, score }`, best first. */
export function lexicalSearch(
  ms: MiniSearch,
  query: string,
  k: number
): { index: number; score: number }[] {
  return ms
    .search(query, SEARCH_OPTIONS)
    .slice(0, k)
    .map((r) => ({ index: r.id as number, score: r.score }));
}

/**
 * Reciprocal Rank Fusion. Each input list is item ids in rank order (best first).
 * Returns a map of id → fused score. Rank-based, so it needs no per-query score
 * calibration between the (unrelated) cosine and BM25 scales.
 */
export function rrfFuse(rankedLists: number[][], k = RRF_K): Map<number, number> {
  const scores = new Map<number, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}
