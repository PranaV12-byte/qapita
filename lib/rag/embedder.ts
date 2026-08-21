import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Embedder } from "./types";
import {
  EMBEDDER_MODEL,
  EMBEDDING_DIM,
  QUERY_PREFIX,
  ALLOW_REMOTE_MODELS,
} from "./config";

// transformers.js feature-extraction pipeline signature (loosely typed).
type PipelineFn = (
  input: string | string[],
  opts: Record<string, unknown>
) => Promise<{ data: Float32Array; dims: number[] }>;

const POOL_OPTS = { pooling: "mean", normalize: true } as const;
const BATCH = 32;

/**
 * Local bge-base-en-v1.5 embedder via Transformers.js.
 * Asymmetric: queries get the bge instruction prefix, passages do not
 * (see the model README — mean pooling + normalize for both).
 */
export class TransformersEmbedder implements Embedder {
  readonly id = EMBEDDER_MODEL;
  readonly dim = EMBEDDING_DIM;
  private pipe: PipelineFn | null = null;
  private loading: Promise<PipelineFn> | null = null;

  private async load(): Promise<PipelineFn> {
    if (this.pipe) return this.pipe;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowRemoteModels = ALLOW_REMOTE_MODELS;
      const p = await pipeline("feature-extraction", EMBEDDER_MODEL);
      this.pipe = p as unknown as PipelineFn;
      return this.pipe;
    })();
    return this.loading;
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const p = await this.load();
    const out = await p(QUERY_PREFIX + text, POOL_OPTS);
    return Float32Array.from(out.data);
  }

  async embedPassage(text: string): Promise<Float32Array> {
    const p = await this.load();
    const out = await p(text, POOL_OPTS);
    return Float32Array.from(out.data);
  }

  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const p = await this.load();
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const out = await p(batch, POOL_OPTS);
      const dim = out.dims[out.dims.length - 1];
      for (let j = 0; j < batch.length; j++) {
        results.push(
          Float32Array.from(out.data.subarray(j * dim, j * dim + dim))
        );
      }
    }
    return results;
  }
}

let _embedder: Embedder | null = null;

/** Process-wide embedder singleton (defers the model load to first use). */
export function getEmbedder(): Embedder {
  if (!_embedder) _embedder = new TransformersEmbedder();
  return _embedder;
}

// ── Content-hash embedding cache (ingest only) ──────────────────────────────────
// Keyed by the exact string embedded (the contextual embed-input, not raw text),
// so any chunking/heading/context change is a targeted miss. Lets an overnight
// re-run reuse all unchanged work instead of re-embedding the whole corpus.

export class EmbedCache {
  private map = new Map<string, Float32Array>();
  private loaded = false;
  private hits = 0;
  private misses = 0;

  constructor(private readonly file: string) {}

  private static key(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!fs.existsSync(this.file)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Record<
        string,
        number[]
      >;
      for (const [k, arr] of Object.entries(raw)) {
        this.map.set(k, Float32Array.from(arr));
      }
    } catch {
      // Corrupt cache → start fresh rather than crash the build.
      this.map.clear();
    }
  }

  /** Embed passages via `embedder`, reusing cached vectors. Result aligns to `texts`. */
  async embedPassages(
    embedder: Embedder,
    texts: string[]
  ): Promise<Float32Array[]> {
    this.load();
    const out: Array<Float32Array | null> = new Array(texts.length).fill(null);
    const missIdx: number[] = [];
    const missText: string[] = [];

    texts.forEach((t, i) => {
      const cached = this.map.get(EmbedCache.key(t));
      if (cached) {
        out[i] = cached;
        this.hits++;
      } else {
        missIdx.push(i);
        missText.push(t);
        this.misses++;
      }
    });

    if (missText.length > 0) {
      const embedded = await embedder.embedPassages(missText);
      embedded.forEach((v, j) => {
        out[missIdx[j]] = v;
        this.map.set(EmbedCache.key(missText[j]), v);
      });
    }

    return out as Float32Array[];
  }

  flush(): void {
    const obj: Record<string, number[]> = {};
    for (const [k, v] of this.map.entries()) obj[k] = Array.from(v);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(obj));
  }

  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.map.size };
  }
}

/**
 * Embed `texts` in fixed-size blocks, reporting real progress after each block
 * and (optionally) reusing an EmbedCache so unchanged inputs are never
 * re-embedded. Result aligns to `texts`. When `cache` is null the embedder is
 * called directly. Progress is reported as (processedSoFar, total); an empty
 * input reports (0, 0) exactly once so a caller's progress bar can complete.
 */
export async function embedInBlocks(
  cache: EmbedCache | null,
  embedder: Embedder,
  texts: string[],
  blockSize = 16,
  onProgress?: (current: number, total: number) => void
): Promise<Float32Array[]> {
  const total = texts.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return [];
  }
  const out: Float32Array[] = [];
  for (let i = 0; i < total; i += blockSize) {
    const block = texts.slice(i, i + blockSize);
    const vecs = cache
      ? await cache.embedPassages(embedder, block)
      : await embedder.embedPassages(block);
    out.push(...vecs);
    onProgress?.(out.length, total);
  }
  return out;
}
