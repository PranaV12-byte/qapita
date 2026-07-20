# Q4N$P — Equity-Comp Knowledge Portal (Qapita)

> **Current phase: Phase 1 — RAG chatbot demo.** Spec: `SPEC-PHASE1.md`.
> Phase 2 (browse, glossary, search, content pages): `SPEC-PHASE2.md` — do NOT implement yet.

## Golden rules
1. `npm i && npm run dev` MUST work with zero external services and zero API keys (mock path).
2. Embeddings are ALWAYS local via `@xenova/transformers` — no API key, no network at runtime. Default offline-ready model: `all-MiniLM-L6-v2` (384-dim). Upgrade to `bge-base-en-v1.5` (768-dim, asymmetric — query instruction prefix on queries only) by placing its ONNX weights locally and setting `EMBEDDER_MODEL` / `EMBEDDING_DIM=768` / `EMBED_QUERY_PREFIX`. Optional local cross-encoder rerank (`ms-marco-MiniLM-L-6-v2`) via `RERANK_ENABLED=true` once its weights are present. Retrieval is hybrid dense+lexical (RRF) with tier weighting, scrape-tier dedup, and parent-section context expansion. Set `ALLOW_REMOTE_MODELS=true` only on a networked machine to fetch model weights once.
3. Only text generation is env-switched: `LLM_PROVIDER=mock|groq|anthropic`.
4. No database. Vector index = `data/vectors.bin` + `data/chunks.json`. Logs = JSONL / console.
5. Never render raw-scrape text verbatim. Never quote or closely paraphrase scrape-tier chunks.
6. Every page: draft strip + disclaimer + `<meta name="robots" content="noindex">`. No NASPP marks.
7. Windows dev box: use `tsx`, `node:path`, `fast-glob`; no bash-isms in scripts.
8. Use `next-mdx-remote/rsc` (NOT @next/mdx). Use `@react-pdf/renderer` (NOT Playwright).
9. All inputs/textareas fixed 16px (prevents iOS zoom). Tap targets >= 44x44px.
10. Content = real equity-comp facts, own words, grounded in primary authorities (IRC/IRS/SEC/FASB/ASC 718). myStockOptions and NASPP data MAY be ingested as scrape-tier retrieval grounding, but their expression is NEVER reproduced — not verbatim and not paraphrased/reworded. Answers state the underlying facts (facts are not copyrightable) in genuinely original wording; the source text only grounds what is true, it is never rewritten into the output. (Reinforces rule #5.)

## Design tokens (CSS variables, wire into Tailwind)
```
--bg #0A0A0B    --surface-1 #121214   --surface-2 #17171A
--border #26262A  --border-strong #33333A
--text-head #F0EEE8  --text-primary #C9C9CF  --text-body #A6A6AD  --text-muted #85858E
--accent #5FAE9E  --accent-solid #2F6A5B  --accent-on #EAF3F0  --accent-line #3E8576
--draft #D6A85C  --certified #7FB972  --danger #D97070
```
Fonts: Instrument Serif 400 (headings, never below 20px) + Inter 400/500 (body/UI).
Dark-first near-monochrome. Teal accent ONLY on: links, primary action, active nav, tracked labels.

## Stack (pinned)
Next.js App Router + TS strict + Tailwind + next-mdx-remote/rsc + gray-matter + Zod +
@xenova/transformers + MiniSearch + @react-pdf/renderer + Vitest.

## Retrieval constants
- Curated tier weight: 1.0, scrape tier weight: 0.7
- nodeId boost: 1.5x
- Top-k after merge: 8, scrape cap: 3
- Fallback threshold (curated cosine): 0.35
- Fallback = nearest scenario by cosine over pre-embedded scenario vectors

## Key microcopy (use verbatim)
- Draft strip: "Draft — AI-generated, not reviewed · Educational only, not advice"
- Footer: "This is an AI-generated draft that has not been reviewed by a professional. It is educational only and is not tax, legal, or investment advice. US only."
- Generate placeholder: `Describe the problem — e.g. "An employee is asking why taxes were withheld at vest"`
