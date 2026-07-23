# SPEC-VAULT — Obsidian-grade graph, readable notes, fast ingest

> **Status: approved plan, not yet started.** Builds on the completed Second Brain (`SPEC-BRAIN.md`, done at commit `9298847`). Same phase-gate protocol: every phase ends with **tsc clean + full vitest green + preview/manual checks + a checkpoint commit**; a red gate blocks the next phase. Run one phase per session; start each session by reading this file's phase + its Read list only.

## 1. Context

The Second Brain works end-to-end but the flagship `/brain` surface is below bar: the graph is static/janky (no physics; wheel-zoom fights page scroll; coarse 0.8×/1.25× jumps; labels only on hover), clicking a node shows a stub panel not readable content, and ingest is slow (~4–8s warm, ~15–20s first) behind a fake progress bar. Owner direction: make `/brain` an **Obsidian-grade, graph-first experience** — beautiful smooth-physics graph as the main view; click a node → **read the actual markdown**; a **backlinks** section; keep upload / health-check / erase / lint; **make ingest fast**. UI samples approved (physics demo, side-pane note reader, mobile bottom sheet + honest ingest card).

**Decisions locked with owner:** note opens in a **side pane** (graph stays live; mobile bottom sheet; `?note=` deep link) · topic pages = **curated article + "From your sources" + AI synthesis** with deterministic offline fallback · graph physics = **d3-force** (one new runtime dep + `@types/d3-force`). Design calls (approved via samples): backlinks at the bottom of the note pane; add a Ctrl-K quick-switcher + filter chips; keep the list-view a11y fallback. **Deferred:** Obsidian zip-export (owner deprioritized in favor of the in-app experience).

## 2. Invariants (carried from SPEC-BRAIN §2 — never break)

`retrieveWith` untouched · empty-brain `/api/artifact` byte-identical (characterization pinned) · **no `dangerouslySetInnerHTML`** — the note renderer is element-based · embeddings local, offline mock path always works with zero keys · `lib/brain/store.ts` is the ONLY writer of `data/brains/**` · every LLM step has deterministic heuristic parity · caps/warns never silent · Windows-safe scripts · every page disclaimer + noindex · 16px inputs / ≥44px targets · the 371-test baseline only grows; alignment + characterization tests never edited to pass.

## 3. Why ingest is slow → the fix (measured against the code)

Each upload today: cold-loads the embedder + 41 node targets on first use; **chunks the doc twice** (`placement.ts` and `weave.ts` each call `chunkMarkdown`) and **embeds ~2.2×** (healthCheck probe + placement re-embeds a doc probe *and* every section, then weave embeds every chunk); user content bypasses the existing `EmbedCache`; progress is a fake pulse. Fix: **single-pass** — chunk once, embed chunk-vectors once through a cache, derive section vectors as normalized means for placement scoring, reuse healthCheck's probe vector; warm the model + node targets at boot; real per-passage progress. Target: warm **<1.5s**, first-ever **~3–4s**.

---

## 4. Phases

### V0 — Fast ingest (backend only, no UI change)
- **Single-pass pipeline** (`lib/brain/jobs.ts`): extract → `chunkMarkdown` once → `buildEmbedInput` once → embed via a shared `EmbedCache` (`data/.brain-embed-cache.json`, gitignored) → thread `{chunks, sections, title, chunkVecs, probeVector}` through vet → placement → weave.
- `placement.ts`: add a plan-from-precomputed path (section vector = normalized mean of its chunk vecs; novelty check reuses healthCheck `probeVector`; LLM path unchanged). Keep `planPlacement(title, markdown)` working for callers/tests.
- `weave.ts`: accept an optional precomputed `{chunks, sections, chunkVecs}` and skip re-chunk/re-embed; **existing signature must keep working** (weave-alignment + confirm-path depend on it).
- **Warm-up**: `instrumentation.ts` (Next 15) fire-and-forget `getEmbedder()` + `getNodeTargets()` on the nodejs runtime; swallow failures.
- **Real progress**: `weaveSource` gains `onProgress(current,total)` wired to the job record; embed in blocks.
- **Read list:** `lib/brain/{jobs,placement,weave,healthCheck,embedder}.ts`, `lib/rag/embedder.ts`.
- **Tests:** fast path byte-identical to legacy delta (reuse alignment invariant); re-upload → 0 embedder calls (fake-embedder counter); progress reaches total; all existing brain tests green unchanged.
- **Gate:** tsc · suite · dev-server timing log (before/after) · commit.

### V1 — Wiki page model + note API
- `lib/brain/wiki.ts` `buildNotePage(brainId, id)` for id ∈ `nodeId | source:<id> | pillar:<slug> | general` → `{kind,title,meta,markdown,backlinks[]}`. Source → `extracted.md`; topic → curated article (`loadArticle`) + "## From your sources" (attributed passages) + "## Synthesis" (`wiki/<nodeId>.md` if present); u-node → synthesis + passages; pillar → `[[links]]` index. Backlinks = weave edges + crossLinks + `[[mention]]` scan of `wiki/*.md` + curated `related` + `answers.jsonl` citations, each with a snippet.
- `maintain.ts` `authorNodeSynthesis(nodeTitle, passages, linkableTitles)` → short `[[linked]]` markdown (Zod-validated; ≤10 nodes/ingest; template fallback = lead sentences + per-source bullets + crossLink `[[links]]`). `weave.ts` writes `wiki/<nodeId>.md` for touched nodes via the store's atomic writer.
- `GET /api/brain/note/[id]` (nodejs, cookie via `getBrainId`).
- **Read list:** `lib/brain/{wiki(new),weave,maintain,store,graph}.ts`, `lib/content/{loader,tree}.ts`, `lib/llm/groq.ts` (Zod pattern).
- **Gate:** tsc · suite (+ wiki/note-api tests) · commit.

### V2 — Graph rewrite (d3-force + canvas)
- `npm i d3-force @types/d3-force`.
- Rewrite `components/brain/BrainGraph.tsx` as a **canvas** renderer matching the approved demo: d3-force sim seeded from `composeGraphModel` positions; rAF loop; **smooth zoom-to-cursor** via a native `wheel` listener `{passive:false}` (fixes page-scroll jank); pinch; drag-node (fx/fy + reheat); pan; DPR-crisp labels with zoom-fade; neighbourhood dim/highlight; `?focus=` pulse; fit/± controls; **Ctrl-K quick-switcher** (filter + fly-to); filter chips; keep ListView + ≥44px hits.
- `lib/brain/graph.ts`: add node degree for sizing (model/tests otherwise unchanged).
- **Read list:** `components/brain/BrainGraph.tsx`, `lib/brain/graph.ts`, `app/brain/client.tsx`.
- **Gate:** tsc · suite (graph-model green) · preview (wheel-zoom never scrolls page; smooth anchored zoom; organic settle; label fade; focus pulse; mobile pinch; no console errors) · commit.

### V3 — Note pane UI (the vault reader)
- `components/brain/NoteMarkdown.tsx`: element-based markdown renderer (extend ArtifactResult's SimpleMarkdown) incl. `[[wiki-link]]` → in-app navigate. No raw HTML.
- `components/brain/NotePane.tsx` (absorbs `NodePanel`): fetch `/api/brain/note/[id]` on select; header (kind chip/title/meta), scroll body, **Backlinks** collapsible (mentions w/ snippets + answers-that-cited), footer (Ask about this → `/generate?nodeId=`; Delete source w/ confirm). Desktop side pane; mobile bottom sheet; `?note=` sync; citation `?focus=` auto-opens note.
- `app/brain/client.tsx`: relayout to graph-first shell (toolbar with quick-switcher + Add files + ⋯ menu for Run health check / Erase); restyle `IngestQueue` (stage chips + real % + result chips); keep SourceTable + LintPanel below.
- **Read list:** `app/brain/client.tsx`, `components/brain/{NodePanel,IngestQueue,BrainStats,SourceTable,LintPanel}.tsx`, `components/ArtifactResult.tsx`.
- **Gate:** tsc · suite · preview E2E (click node → markdown; `[[links]]` + backlinks navigate; source shows extracted.md; delete/erase/lint/upload work; mobile sheet; characterization green) · commit.

### V4 — Polish, lint, docs, acceptance
- `lint.ts`: broken `[[link]]` detector over `wiki/*.md` (auto-applicable: rewrite to plain text).
- Docs: CLAUDE.md Second Brain section (wiki pages, note API, d3-force, perf, `.brain-embed-cache`); flip this file's status + deviations log.
- Final acceptance: timing report (cold + warm, before/after), full E2E incl. quick-switcher + citation focus-pulse, one screenshot.
- **Gate:** warm upload <1.5s (logged) · all prior E2E intact · tsc · full suite · commit.

## 5. Explicitly NOT doing
Obsidian zip-export · answers-as-graph-nodes · in-app note editing · WebGL renderer · touching `lib/rag/retriever.ts` or `/api/artifact`.
