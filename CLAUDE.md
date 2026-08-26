# Q4N$P — Equity-Comp Knowledge Portal (Qapita)

> **Current phase: Phase 1 — RAG chatbot demo.** Spec: `SPEC-PHASE1.md`.
> Phase 2 (browse, glossary, search, content pages): `SPEC-PHASE2.md` — do NOT implement yet.
> **Flagship feature (IMPLEMENTED): Second Brain / the Wiki — spec: `SPEC-BRAIN.md` (Phases 0–7 complete, gates green).** See the "Second Brain" section below. Any further changes still follow SPEC-BRAIN §2 invariants + §4 protocol.
> **Vault upgrade (IMPLEMENTED): Obsidian-grade graph + readable notes + fast ingest — spec: `SPEC-VAULT.md` (Phases V0–V4 complete, gates green).** Builds on the Second Brain; carries SPEC-BRAIN §2 invariants.

## Golden rules
1. `npm i && npm run dev` MUST work with zero external services and zero API keys (mock path).
2. Embeddings are ALWAYS local via `@xenova/transformers` — no API key, no network at runtime. Default offline-ready model: `all-MiniLM-L6-v2` (384-dim). Upgrade to `bge-base-en-v1.5` (768-dim, asymmetric — query instruction prefix on queries only) by placing its ONNX weights locally and setting `EMBEDDER_MODEL` / `EMBEDDING_DIM=768` / `EMBED_QUERY_PREFIX`. Optional local cross-encoder rerank (`ms-marco-MiniLM-L-6-v2`) via `RERANK_ENABLED=true` once its weights are present. Retrieval is hybrid dense+lexical (RRF) with tier weighting, scrape-tier dedup, and parent-section context expansion. Set `ALLOW_REMOTE_MODELS=true` only on a networked machine to fetch model weights once.
3. Only text generation is env-switched: `LLM_PROVIDER=mock|groq|anthropic`.
4. No database. Vector index = `data/vectors.bin` + `data/chunks.json`. Logs = JSONL / console.
5. Generated-answer prose policy: answers must use original wording and must not quote or cite an external source by name. Never mention NASPP or MyStockOptions in generated prose. Citation identifiers and uploaded source names remain in structured metadata, internal Related Topics links, Brain backlinks, and source cards. Reviewed Wiki reference panels may continue to show their sources.
6. Every page: disclaimer + `<meta name="robots" content="noindex">`. The site header shows the AUTHORIZED NASPP | Qapita co-brand lockup — official marks in `public/brand/` (naspp.png, qapita.png — both transparent, white knocked out) wired via `components/brand/Logos.tsx`, sitting directly on the dark bar with a separator. NASPP branding/content is NOT otherwise reproduced anywhere else.
7. Windows dev box: use `tsx`, `node:path`, `fast-glob`; no bash-isms in scripts.
8. Use `next-mdx-remote/rsc` (NOT @next/mdx). Use `@react-pdf/renderer` (NOT Playwright).
9. All inputs/textareas fixed 16px (prevents iOS zoom). Tap targets >= 44x44px.
10. Content = real equity-comp facts grounded in primary authorities (IRC/IRS/SEC/FASB/ASC 718). NASPP data may be used as grounding, but generated prose must not name or quote it. **myStockOptions (the internal `NSO` corpus) is NOT used at all — excluded at ingest in `scripts/ingest/build.ts`** (any source resolving to `myStockOptions` is skipped). User-uploaded material is the `user` tier — a per-brain overlay whose source identity remains available through structured citations and Brain source cards, not generated prose. For general equity-comp facts, still prefer original wording (facts are not copyrightable).

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

## Second Brain (flagship — `SPEC-BRAIN.md`)
Per-user "wiki": the shared foundation (curated + NASPP) with each visitor's uploads woven in; every question retrieves against foundation ⊕ their delta as ONE graph.
- **Identity:** anonymous `q4np-brain` httpOnly cookie via `middleware.ts` (no accounts). `lib/brain/id.ts` is the Edge-safe home for `isValidBrainId`/`getBrainId`.
- **Storage:** flat files under `data/brains/<brainId>/` (gitignored) — `lib/brain/store.ts` is the ONLY module that writes there (atomic temp+rename, per-brain mutex, LRU). No DB (rule #4 holds). `data/node-targets.{bin,json}` is a gitignored classification cache.
- **`user` tier:** new `Tier` member; `ChunkMeta.sourceId` groups a source's chunks; brain-local topic ids are `u-<slug>`. Citations carry `kind: topic|source|user-node`, resolved server-side (`lib/brain/retrieval.ts`) so user sources are never dropped.
- **Ingest:** `POST /api/brain/sources` (multipart, ≤10/batch) → per-file job (`lib/brain/jobs.ts`) → `extract.ts` (md/txt/pdf/docx/csv/tsv/xlsx/html/json via lazy `unpdf`/`mammoth`/`exceljs`/`turndown`) → `healthCheck.ts` (readable/caps/on-topic/duplicate/non-English) → `placement.ts` + `weave.ts` (append preserving the vectors↔chunks↔lexical row-alignment invariant).
- **Retrieval:** `retrieveMulti` (additive; `retrieveWith` untouched) + graph neighbour expansion (`GRAPH_EXPANSION`). Empty brain = byte-identical to the pre-brain path (characterization-pinned).
- **LLM maintenance** (`maintain.ts`): placement / node-summaries / lint review, all behind `LLM_PROVIDER` with **deterministic heuristic parity offline** — ingest/lint never block on the LLM. Prompts fence uploaded content as data (injection defense).
- **Lint** (`lint.ts`): cadence (≥`LINT_APPEND_THRESHOLD` appends or >`LINT_STALE_DAYS` days) + on-demand; auto-applies structural fixes (orphan-node / broken-edge / broken-`[[link]]`), destructive fixes route through DELETE.
- **Retention:** `npm run brains:prune` (dry-run default; `--days N --apply`). Erase via `DELETE /api/brain`.
- **New config** (`lib/rag/config.ts`, all env-overridable): `USER_WEIGHT`, `GRAPH_EXPANSION`, `NEIGHBOR_LIMIT`, `NEIGHBOR_MIN_COSINE`, `BRAIN_MAX_FILE_MB`, `BRAIN_MAX_TEXT_MB`, `BRAIN_MAX_PASSAGES`, `BRAIN_BATCH_LIMIT`, `LINT_APPEND_THRESHOLD`, `LINT_STALE_DAYS`, `BRAIN_LRU`.

### Vault upgrade (`SPEC-VAULT.md`) — the `/brain` surface
- **Fast ingest (V0):** single-pass pipeline — `jobs.ts` chunks once (docId === sourceId), embeds each chunk once through a shared `EmbedCache` (`data/.brain-embed-cache.json`, gitignored) with **real per-passage progress**, and reuses those vectors for BOTH placement (`placement.ts` precomputed path: section vector = normalized mean of chunk vecs; doc-novelty reuses healthCheck's `probeVector`) AND the weave (`weave.ts` optional precomputed bundle). `lib/rag/embedder.ts` `embedInBlocks` does the block-embed + cache. `instrumentation.ts` → `lib/warmup.ts` warms the embedder + node targets at boot (nodejs runtime only; guarded so it never enters the edge bundle). Warm upload <1.5s. Pre-V0 `planPlacement`/`weaveSource` signatures still work unchanged.
- **Wiki pages + note API (V1):** `lib/brain/wiki.ts` `buildNotePage(brainId, id)` (id ∈ `nodeId | source:<id> | pillar:<slug> | general`) → `{kind,title,meta,markdown,backlinks[]}`. Topic = curated article (MDX component tags unwrapped) + "## From your sources" (attributed passages) + "## Synthesis" (`wiki/<nodeId>.md`). Backlinks = weave edges + crossLinks + curated `related` + answers + `[[mention]]` scans. `maintain.ts` `authorNodeSynthesis` writes `wiki/<nodeId>.md` at weave time (LLM + template parity). `GET /api/brain/note/[id]` (nodejs).
- **Graph (V2):** `components/brain/BrainGraph.tsx` is a **canvas + d3-force** renderer (one runtime dep: `d3-force`). Smooth zoom-to-cursor via a native `wheel` `{passive:false}` listener, node drag (fx/fy reheat), pan/pinch, zoom-fading labels, neighbourhood highlight, `?focus=` pulse, Ctrl-K quick-switcher, filter chips; ListView a11y fallback kept. Draw goes through a ref (no stale closures); first paint is synchronous. `graph.ts` adds node `degree` for sizing.
- **Note pane (V3):** `components/brain/{NoteMarkdown,NotePane}.tsx` — element-based markdown (`[[wiki-link]]` navigation, no `dangerouslySetInnerHTML`), side pane (desktop) / bottom sheet (mobile), collapsible backlinks, Ask / Delete actions. `app/brain/client.tsx` is graph-first; `?note=` deep link + citation `?focus=` auto-open, URL synced via `history.replaceState`. `IngestQueue` shows the real weave %.

## Key microcopy (use verbatim)
- Draft strip: "Draft — AI-generated, not reviewed · Educational only, not advice"
- Footer: "This is an AI-generated draft that has not been reviewed by a professional. It is educational only and is not tax, legal, or investment advice. US only."
- Generate placeholder: `Describe the problem — e.g. "An employee is asking why taxes were withheld at vest"`
