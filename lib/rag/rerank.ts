import type { Reranker } from "./types";
import { RERANKER_MODEL, ALLOW_REMOTE_MODELS } from "./config";

// transformers.js tokenizer / model are dynamically imported and loosely typed.
type Tokenizer = (
  text: string[],
  opts: Record<string, unknown>
) => Promise<Record<string, unknown>>;
type Model = (
  inputs: Record<string, unknown>
) => Promise<{ logits: { data: Float32Array; dims: number[] } }>;

const BATCH = 16;

/**
 * Local cross-encoder reranker (ms-marco-MiniLM-L-6-v2). Scores each
 * (query, doc) pair; higher = more relevant. Raw logits are returned — ordering
 * is all the caller needs, so no sigmoid is applied.
 */
export class CrossEncoderReranker implements Reranker {
  readonly id = RERANKER_MODEL;
  private tokenizer: Tokenizer | null = null;
  private model: Model | null = null;
  private loading: Promise<void> | null = null;

  private async load(): Promise<void> {
    if (this.tokenizer && this.model) return;
    if (!this.loading) {
      this.loading = (async () => {
        const { AutoTokenizer, AutoModelForSequenceClassification, env } =
          await import("@xenova/transformers");
        env.allowRemoteModels = ALLOW_REMOTE_MODELS;
        this.tokenizer = (await AutoTokenizer.from_pretrained(
          RERANKER_MODEL
        )) as unknown as Tokenizer;
        this.model = (await AutoModelForSequenceClassification.from_pretrained(
          RERANKER_MODEL
        )) as unknown as Model;
      })();
    }
    await this.loading;
  }

  async rerank(query: string, docs: string[]): Promise<number[]> {
    if (docs.length === 0) return [];
    await this.load();
    const tokenizer = this.tokenizer!;
    const model = this.model!;

    const scores: number[] = [];
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const queries = new Array(batch.length).fill(query);
      const inputs = await tokenizer(queries, {
        text_pair: batch,
        padding: true,
        truncation: true,
      });
      const { logits } = await model(inputs);
      const data = logits.data;
      const numLabels = logits.dims[logits.dims.length - 1] || 1;
      for (let j = 0; j < batch.length; j++) {
        // 1-label models: one relevance logit per pair.
        // multi-label: take the last (positive) class.
        scores.push(
          numLabels === 1 ? data[j] : data[j * numLabels + (numLabels - 1)]
        );
      }
    }
    return scores;
  }
}

let _reranker: Reranker | null = null;

/** Process-wide reranker singleton (defers the model load to first use). */
export function getReranker(): Reranker {
  if (!_reranker) _reranker = new CrossEncoderReranker();
  return _reranker;
}
