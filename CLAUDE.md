# Q4N$P — Equity-Comp Knowledge Portal (Qapita)

> **Current phase: Phase 1 — RAG chatbot demo.** Spec: `SPEC-PHASE1.md`.
> Phase 2 (browse, glossary, search, content pages): `SPEC-PHASE2.md` — do NOT implement yet.
> **Flagship feature (active work): Second Brain / the Wiki — spec: `SPEC-BRAIN.md`.** Implement strictly phase-by-phase per its §4 protocol; a phase only starts after the previous phase's gate (tsc + full tests + manual checks) is green and committed.

## Golden rules
1. `npm i && npm run dev` MUST work with zero external services and zero API keys (mock path).
2. Embeddings are ALWAYS local via `@xenova/transformers` — no API key, no network at runtime. Default offline-ready model: `all-MiniLM-L6-v2` (384-dim). Upgrade to `bge-base-en-v1.5` (768-dim, asymmetric — query instruction prefix on queries only) by placing its ONNX weights locally and setting `EMBEDDER_MODEL` / `EMBEDDING_DIM=768` / `EMBED_QUERY_PREFIX`. Optional local cross-encoder rerank (`ms-marco-MiniLM-L-6-v2`) via `RERANK_ENABLED=true` once its weights are present. Retrieval is hybrid dense+lexical (RRF) with tier weighting, scrape-tier dedup, and parent-section context expansion. Set `ALLOW_REMOTE_MODELS=true` only on a networked machine to fetch model weights once.
3. Only text generation is env-switched: `LLM_PROVIDER=mock|groq|anthropic`.
4. No database. Vector index = `data/vectors.bin` + `data/chunks.json`. Logs = JSONL / console.
5. Never render raw-scrape text verbatim. Never quote or closely paraphrase scrape-tier chunks.
6. Every page: disclaimer + `<meta name="robots" content="noindex">`. The site header shows the AUTHORIZED NASPP | Qapita co-brand lockup — official marks in `public/brand/` (naspp.png, qapita.png — both transparent, white knocked out) wired via `components/brand/Logos.tsx`, sitting directly on the dark bar with a separator. NASPP branding/content is NOT otherwise reproduced anywhere else.
7. Windows dev box: use `tsx`, `node:path`, `fast-glob`; no bash-isms in scripts.
8. Use `next-mdx-remote/rsc` (NOT @next/mdx). Use `@react-pdf/renderer` (NOT Playwright).
9. All inputs/textareas fixed 16px (prevents iOS zoom). Tap targets >= 44x44px.
10. Content = real equity-comp facts, own words, grounded in primary authorities (IRC/IRS/SEC/FASB/ASC 718). NASPP data MAY be ingested as scrape-tier retrieval grounding; **myStockOptions (the internal `NSO` corpus) is NOT used at all — it is excluded at ingest in `scripts/ingest/build.ts`** (any source resolving to `myStockOptions` is skipped). Ingested NASPP expression is NEVER reproduced — not verbatim and not paraphrased/reworded. Answers state the underlying facts (facts are not copyrightable) in genuinely original wording; the source text only grounds what is true, it is never rewritten into the output. (Reinforces rule #5.)

## Design tokens (CSS variables, wire into Tailwind)
```
--bg #0A0A0B    --surface-1 #1A1A1F   --surface-2 #24242B
--border #3A3A44  --border-strong #55555F
--text-head #F0EEE8  --text-primary #D4D4DA  --text-body #B6B6BE  --text-muted #9A9AA5
--accent #5FAE9E  --accent-solid #357A69  --accent-on #EAF3F0  --accent-line #4E9E8C
--draft #D6A85C  --certified #7FB972  --danger #D97070
```
Fonts: Montserrat 600 (headings; Tailwind `font-head`) + Inter 400/500 (body/UI; `font-sans`).
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
