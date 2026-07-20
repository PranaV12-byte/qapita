import { cosineSimilarity } from "./cosine";

export type ScenarioVector = {
  scenarioId: string;
  label: string;
  vector: Float32Array;
};

/**
 * Fallback decision, deliberately on raw dense curated cosine (not the fused or
 * reranked score): the question is "does the curated corpus semantically cover
 * this at all," which dense embeddings answer well. A coincidental lexical/rerank
 * hit must not fake confidence. Triggers when the best curated cosine is below
 * `threshold`, or fewer than 2 results were selected. When it triggers, returns
 * the nearest scenario by cosine.
 */
export function computeFallback(
  queryVec: Float32Array,
  scenarios: ScenarioVector[],
  bestCuratedCosine: number,
  resultCount: number,
  threshold: number
): { fallbackUsed: boolean; fallbackScenario?: { id: string; label: string } } {
  const fallbackUsed = bestCuratedCosine < threshold || resultCount < 2;
  if (!fallbackUsed || scenarios.length === 0) return { fallbackUsed };

  let bestCosine = -Infinity;
  let fallbackScenario: { id: string; label: string } | undefined;
  for (const s of scenarios) {
    const cos = cosineSimilarity(queryVec, s.vector);
    if (cos > bestCosine) {
      bestCosine = cos;
      fallbackScenario = { id: s.scenarioId, label: s.label };
    }
  }
  return { fallbackUsed, fallbackScenario };
}
