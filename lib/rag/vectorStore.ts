import { cosineSimilarity, getRow } from "./cosine";
import type { VectorStore } from "./types";

/**
 * Brute-force flat cosine search over one Float32Array (`size × dim`).
 * Exact and dependency-free; optimal up to ~100k rows. Swap for an ANN impl
 * behind the VectorStore interface beyond that — no caller changes.
 */
export class FlatVectorStore implements VectorStore {
  readonly size: number;
  readonly dim: number;
  private readonly vectors: Float32Array;

  constructor(vectors: Float32Array, dim: number) {
    this.vectors = vectors;
    this.dim = dim;
    this.size = dim > 0 ? Math.floor(vectors.length / dim) : 0;
  }

  search(
    query: Float32Array,
    k: number,
    filter?: (index: number) => boolean
  ): { index: number; cosine: number }[] {
    const scored: { index: number; cosine: number }[] = [];
    for (let i = 0; i < this.size; i++) {
      if (filter && !filter(i)) continue;
      const cosine = cosineSimilarity(query, getRow(this.vectors, i, this.dim));
      scored.push({ index: i, cosine });
    }
    scored.sort((a, b) => b.cosine - a.cosine);
    return scored.slice(0, k);
  }

  row(index: number): Float32Array {
    return getRow(this.vectors, index, this.dim);
  }
}
