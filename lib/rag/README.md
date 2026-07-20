# RAG layer (`lib/rag`)

Local, zero-API-key retrieval for the equity-comp portal. Embeddings and reranking
run on-device via `@xenova/transformers`; only text generation is env-switched
(`LLM_PROVIDER`). All tunables live in [`config.ts`](./config.ts) and are
env-overridable — see [`.env.example`](../../.env.example).

## Query pipeline (`retriever.ts` → `retrieve()`)

1. **Embed query** — `embedder.ts`, asymmetric (query prefix on queries only).
2. **Optional hard pre-filter** — restrict candidates to a node/pillar.
3. **Dense recall** — `vectorStore.ts` (brute-force cosine; ANN-swappable behind the `VectorStore` interface).
4. **Lexical recall** — `lexical.ts` (MiniSearch BM25), catches exact identifiers (`Form 3921`, `83(b)`, …) a bi-encoder blurs.
5. **RRF fusion** — `lexical.ts` `rrfFuse()`, rank-based so the two score scales need no calibration.
6. **Tier weight + node boost** — curated 1.0 / scrape 0.7, ×1.5 on a matched node.
7. **Rerank** (optional) — `rerank.ts` cross-encoder; off unless `RERANK_ENABLED=true` and weights are present.
8. **Select** — `select.ts`, top-k with a scrape cap and scrape near-duplicate skip.
9. **Parent expansion** — selected chunks carry their parent-section text for generation context.
10. **Fallback** — `fallback.ts`, nearest scenario when best dense cosine < `FALLBACK_THRESHOLD`.

Nothing scrape-tier is ever rendered verbatim or paraphrased — it only grounds the
LLM, which answers in original wording (CLAUDE.md #5/#10). The prompt lives in
`lib/llm/prompt.ts`.

## Ingest workflow (`scripts/ingest`)

Build artifacts land in `data/` (all gitignored): `vectors.bin`, `chunks.json`,
`parents.json`, `lexical-index.json`, `index-manifest.json`, `.embed-cache.json`.

```bash
# 1. Suggest a taxonomy node per source file → reviewable CSV
SCRAPE_INBOX=./path/to/markdown npm run classify
#    → data/scrape-review/classification-queue.csv  (edit dispositions by hand)

# 2. Turn the reviewed CSV into the build manifest
npm run apply-classification
#    → data/scrape-manifest.json

# 3. Build the index (curated articles + manifest scrape files + scenarios)
npm run build:index
```

`build.ts` embeds through the content-hash `EmbedCache`, so re-runs after small
edits reuse unchanged vectors instead of re-embedding the whole corpus.
Classification disposition is three-way: a specific node, the `general` bucket
(on-topic but node-less), or `off-topic` (excluded, count logged).
