/** Cosine similarity between two equal-length vectors. Returns 0 if either is zero. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/** Extract row i from a flat Float32Array where each row has `dim` elements. */
export function getRow(flat: Float32Array, i: number, dim: number): Float32Array {
  return flat.subarray(i * dim, i * dim + dim);
}
