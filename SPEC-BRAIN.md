# SPEC-BRAIN — Second Brain ("the Wiki")

> **Status: approved plan, pending final user review. Do not start before review sign-off.**
> Flagship feature. Implementation is phased; **every phase ends with a hard gate** (typecheck + tests + manual verify) — a phase is not done until its gate is green, and a red gate blocks the next phase.

---

## 1. Feature summary

Adapting Karpathy's "LLM Wiki" (gist `442a6bf…`): each visitor has **ONE graph — the wiki** — the shared source foundation (7 pillars → 41 topics → `general`, with tree + `related` edges, backed by curated + NASPP passages) **with the user's own vetted files woven into it**.

- **Identity:** anonymous per-browser cookie ID (no accounts). One seam for future auth.
- **Ingest:** upload MD/TXT/PDF/DOCX/CSV/TSV/XLSX/HTML/JSON → extracted **locally** → vetted (health check: readable, on-topic, duplicate; + LLM judgement when a provider is on) → **woven into existing topic node(s)** — a doc's sections are placed independently, so one file can feed several nodes — or a **new brain-local node** only when genuinely novel.
- **Query:** every question retrieves against the whole wiki (foundation ⊕ user delta in one ranking), with **graph-aware neighbour expansion**. Answers **may quote both NASPP grounding and the user's own sources, with attribution** (policy change).
- **Lint:** periodic + on-demand wiki health check (duplicates, orphans, drift, staleness, contradictions, broken links, weak summaries). LLM-reviewed when available, heuristic otherwise. Destructive fixes always confirm-first.
- **Graph UI:** interactive dependency-free SVG map with **backlink provenance** — answer citations deep-link into the graph and pulse the exact nodes the answer drew from.
- **LLM maintenance** (placement, node summaries, cross-links, lint) is gated behind `LLM_PROVIDER` with **full heuristic parity offline** — the mock path never degrades to broken.

---

## 2. Non-negotiable invariants (never break these)

1. `npm i && npm run dev` works offline, zero keys (mock path). Every LLM-dependent step has a deterministic heuristic fallback.
2. Embeddings always local via `@xenova/transformers`. No network at runtime.
3. No database. All brain state = flat files under `data/brains/<brainId>/` (gitignored).
4. **Row alignment:** `vectors.bin` row *i* ↔ `chunks.json[i]` ↔ lexical doc id *i* — in the foundation AND in every brain delta. This is the index linchpin; it gets invariant tests before any weave code is written.
5. **`retrieveWith()` in `lib/rag/retriever.ts` is not modified.** All retrieval changes are additive (new `retrieveMulti` + shared helpers). Empty-brain behavior of `POST /api/artifact` must remain byte-equivalent to today.
6. Rendering stays React-element-based (auto-escaped). No `dangerouslySetInnerHTML` anywhere new — user file content reaches the DOM only through element renderers.
7. Uploaded content entering any LLM prompt is wrapped as **data, not instructions** (injection defense).
8. Original filenames never appear in filesystem paths (storage keyed by generated `sourceId`); binary/NUL payloads rejected; UTF-8 with latin-1 fallback.
9. Every page: disclaimer + `noindex`. Inputs 16px; tap targets ≥ 44px. Windows-safe scripts (`tsx`, `node:path`, `fast-glob`, no bash-isms).
10. Never silently drop a user file or a cap — every rejection/warn carries a human-readable reason surfaced in the UI.
11. **CLAUDE.md rules #5/#10 change** (quoting policy) as part of Phase 7 — answers may quote NASPP + user sources with attribution. (Open item: confirm NASPP quoting sits within the NASPP authorization.)

---

## 3. Locked architecture decisions

### 3.1 Identity
- `middleware.ts` (new, repo root) guarantees an httpOnly `q4np-brain` cookie (Web-Crypto `randomUUID`, `sameSite=lax`, 1-year). Middleware is **required** — RSC pages cannot set cookies. It forwards the cookie to same-request handlers via request-header rewrite. Matcher scoped to: `/`, `/generate`, `/brain`, `/api/artifact*`, `/api/brain*`.

### 3.2 Storage layout (per brain, all gitignored)
```
data/brains/<brainId>/
  manifest.json     sources, counts, caps state, lint cadence state
  graph.json        u-nodes, weave edges, node summaries, backlink data
  sources/<sourceId>/original.<ext> + extracted.md
  vectors.bin, chunks.json, parents.json, lexical-index.json   (the delta index)
  answers.jsonl     {artifactId, title, citations, ts} — powers backlinks + recent questions
  journal.md        append-only audit (Karpathy log.md)
  catalog.md        one line per source (Karpathy index.md)
  lint-report.json  latest findings + applied/dismissed state
```

### 3.3 Types & citations
- `Tier` gains `"user"`. `ChunkMeta` gains optional `sourceId`. User-created graph nodes use namespaced ids `u-<slug>` (brain-local, never collide with tree ids).
- `Citation` gains `kind: "topic" | "source" | "user-node"` (+ optional `sourceId`). Topic → article link (existing). Source / user-node → `/brain?focus=<id>` deep link. **Labels are resolved server-side** (tree title, or brain graph title, or source display name) so no provider can drop them.

### 3.4 Retrieval composition
- New `retrieveMulti(query, storesList, opts)` — additive. Foundation store + brain delta store searched in a unified index space (delta indices offset by foundation length); union dense + lexical hits; then the **existing** RRF → tier-weight/boost → `selectResults` → parent-expansion → fallback logic via shared helpers extracted (not rewritten) from `retrieveWith`.
- **Neighbour expansion** (after selection): ≤ `NEIGHBOR_LIMIT` extra passages from graph neighbours of top hits (same-node next-best, `related`-node best, user-source siblings), gated at `NEIGHBOR_MIN_COSINE`, marked `neighbor` for the prompt. Env-switchable.
- Per-brain loaded-delta LRU (`BRAIN_LRU`); invalidation hooks on weave/remove/erase; `clearCache()` extended.

### 3.5 LLM maintenance gating
- All maintenance intelligence flows through the existing `LLM_PROVIDER=mock|groq|anthropic` switch. Provider on → placement, node summaries, cross-links, lint review as **Zod-validated structured outputs** with hard call budgets. Provider off / call fails / output malformed → deterministic heuristics (cosine placement vs cached topic fingerprints, similarity + `related` edges, extractive summaries, heuristic lint). **Ingest and lint never block on the LLM.**

### 3.6 Formats & dependencies (final)
- Accepted: `.md .markdown .txt .pdf .docx .csv .tsv .xlsx .html .htm .json`. Rejected with clear message: `.rtf`, `.doc`, anything else.
- New deps (exactly 4; pure-JS, offline, lazy-imported server-side): `unpdf` (PDF), `mammoth` (DOCX), `exceljs` (XLSX), `turndown` (HTML→MD). CSV/TSV → markdown table natively (row-capped); JSON → pretty text (depth/size-capped); MD/TXT native.

### 3.7 Config additions (`lib/rag/config.ts` pattern — env-overridable)
`USER_WEIGHT=1.0` · `GRAPH_EXPANSION=true` · `NEIGHBOR_LIMIT=4` · `NEIGHBOR_MIN_COSINE=0.25` · `BRAIN_MAX_FILE_MB=15` · `BRAIN_MAX_TEXT_MB=1.5` · `BRAIN_MAX_PASSAGES=5000` · `BRAIN_BATCH_LIMIT=10` · `LINT_APPEND_THRESHOLD=5` · `LINT_STALE_DAYS=7` · `BRAIN_LRU=50`.

### 3.8 API surface (all `runtime = "nodejs"`)
- `POST /api/brain/sources` — multipart (≤ batch cap) → `{jobs: [{jobId, fileName}]}`; per-file cap/type failures with reasons.
- `GET /api/brain/ingest/[jobId]` — `{stage, progress, weaveReport? | warn? | fail?}`; `POST /api/brain/ingest/[jobId]/confirm` — add-anyway (optional user-chosen topic) / discard.
- `GET /api/brain` — manifest + graph + lint status; opportunistically triggers cadence lint (async).
- `DELETE /api/brain/sources/[sourceId]` · `POST /api/brain/lint` · `POST /api/brain/lint/apply` · `DELETE /api/brain` (erase; requires confirm token).
- `POST /api/artifact` — same request/response shape; brain-aware via cookie; citations gain `kind`; answer logged to the brain's `answers.jsonl`.

### 3.9 Where it lives in the app
- "My Brain" added to `navLinks` in `components/AppShell.tsx` (+ mobile drawer). New route `app/brain/` (server page + client component), disclaimer + noindex like every page.
- Chat (`app/generate/client.tsx`): subtle strip near the input — "Answering from your wiki · N sources" → `/brain`; answer chips split *Your sources* vs *Topics*.

---

## 4. How to implement this plan — token-efficiency & no-breakage protocol

**The rules below are part of the plan. Follow them in every phase.**

1. **One phase per working session.** Start a session by reading ONLY: (a) this spec's section for the current phase, (b) the files in that phase's **Read list**. Do not re-read the whole repo; do not re-derive decisions settled in §3.
2. **Never read generated data artifacts** (`data/chunks.json`, `vectors.bin`, `parents.json`, `lexical-index.json`, `.embed-cache.json`) into context — they are megabytes. Verify them with counts only (`index-manifest.json`, `rg -c`, file sizes).
3. **Reuse, never rewrite.** These utilities already exist and MUST be imported, not duplicated:
   - `chunkMarkdown` / `splitLeaf` — `lib/rag/chunker.ts`
   - `getEmbedder`, `EmbedCache` — `lib/rag/embedder.ts`
   - `buildEmbedInput` — `scripts/ingest/contextualize.ts` (move/re-export to `lib/` if the import direction demands; do not fork logic)
   - `FlatVectorStore` — `lib/rag/vectorStore.ts`; `cosineSimilarity` — `lib/rag/cosine.ts`
   - `buildLexicalIndex`, `lexicalSearch`, `rrfFuse` — `lib/rag/lexical.ts`
   - `selectResults` — `lib/rag/select.ts`; `computeFallback` — `lib/rag/fallback.ts`
   - `loadStores`, `retrieveWith` — `lib/rag/retriever.ts` (compose; do not modify `retrieveWith`)
   - title/lead extraction pattern — `scripts/ingest/classify.ts` (`extractTitleAndLead`)
   - JSONL append pattern — `lib/log.ts`; Zod response validation pattern — `lib/llm/groq.ts`
   - tree lookups — `lib/content/tree.ts` (`PILLARS`, `ALL_NODES`, `getNode`)
4. **Additive-code rule.** New behavior goes in new modules (`lib/brain/**`) or new exported functions. Shared files (`types.ts`, `config.ts`, `retriever.ts`, `prompt.ts`, `mock.ts`, `route.ts`) receive the smallest possible diffs, listed per phase below. If a change to a shared file isn't listed in this spec, stop and reconsider.
5. **Test order per phase:** write the phase's *invariant/characterization tests first* (they pin current behavior), then implement, then run **targeted** tests (`npx vitest run tests/brain/<file>.test.ts`) after each module, and the **full suite + `npx tsc --noEmit`** only at the phase gate. This keeps feedback loops cheap in tokens and time.
6. **When a test fails:** read the single failing assertion, fix the root cause, re-run the targeted file, then continue. **Never weaken an existing assertion to get green** — the only tests that may legitimately change are the ones this spec explicitly lists per phase (e.g., prompt-text tests after the quoting change). The alignment, regression, and characterization tests must never be edited to pass.
7. **Fixtures are tiny and committed once** (Phase 0): a few-KB sample per format under `tests/fixtures/brain/`. Generate the binary ones (PDF/DOCX/XLSX) with a one-off script in Phase 0 rather than storing large real documents.
8. **Fake embedder in tests.** All brain/retrieval tests inject the deterministic fake embedder the existing suite already uses (`tests/rag/*` pattern) — never load the real model in unit tests. Only the Phase-0 spike and final acceptance touch the real model.
9. **Commit at every phase gate** (checkpoint messages like `brain: phase 2 — extraction+vetting (gate green)`). A failed gate is fixed before anything new is started; never stack unverified work.
10. **UI verification is text-first:** use preview snapshot/console/network/inspect tools over screenshots (screenshot tool is unreliable in this environment); screenshot only for the final acceptance pass.
11. **Don't rebuild the foundation index** during this feature — brain deltas are separate artifacts. Nothing in phases 0–7 requires re-running `build:index`.
12. **Sub-agents:** at most one Explore agent per phase for targeted lookups; never fan out redundant scans — §3 plus phase Read lists already contain the needed context.

---

## 5. Testing strategy overview

- **Invariant tests (write first, never edit):** delta row alignment (rows == entries == lexical ids after N appends/removes); atomic write survives injected crash between temp-write and rename; per-brain mutex serializes interleaved weaves; `retrieveWith` untouched → existing `tests/rag/*` all green throughout.
- **Characterization tests (Phase 1, before shared files change):** pin today's `POST /api/artifact` response shape and mock output for two fixed queries with an empty brain — later phases must keep these green (empty-brain = today's behavior).
- **Fixture matrix (Phase 2):** one good file per format + pathological set: scanned-image PDF, password PDF, binary blob renamed `.md`, empty file, oversize file, whitespace-only extract, non-English text, near-duplicate pair, `.rtf`/`.doc` rejects.
- **Integration tests:** temp-dir brains + fake embedder — ingest→weave→retrieve→delete lifecycle; upload-only question answered with user citation; post-delete disappearance; neighbour expansion contributes a `related`-node passage; caps trigger with reasons.
- **Parity tests (Phase 5):** every LLM-gated operation with `LLM_PROVIDER=mock` returns valid structured results via heuristics; malformed/failed LLM output falls back (simulate with a stub provider that returns garbage).
- **E2E manual matrix (Phases 6–7):** scripted walk in the preview browser (upload each format, watch staged progress, weave report links, graph focus pulse, quote-with-attribution answer, lint findings, erase).
- **Gate = `npx tsc --noEmit` clean + `npm test` fully green + the phase's manual checks.** The suite currently passes 241 tests; that number only goes up.

---

## 6. Phases

---

### Phase 0 — Preflight: baseline + dependency spike

**Objective:** de-risk the only true unknowns (offline parsers) and pin the baseline before any code changes.

**Read list:** none beyond this spec (baseline commands only).

**Steps:**
1. Record the baseline: run typecheck and the full test suite; note the passing count. Confirm `git status` is clean; note the current commit.
2. Install the four parser deps (`unpdf`, `mammoth`, `exceljs`, `turndown`) as regular dependencies.
3. Write a throwaway spike script (scratchpad, not committed) that: creates a tiny PDF (via the already-present `@react-pdf/renderer`), a tiny DOCX and XLSX (via the new libs' write paths or minimal hand-built fixtures), then extracts text from each with the new libs — **with network disabled** — and prints the extracted text.
4. From the spike, generate and commit the fixture set under `tests/fixtures/brain/` (good samples per format + the pathological set from §5; the scanned-PDF fixture is a PDF containing only an embedded image).
5. Add npm script placeholders touched later (`brains:prune`) — optional here, fine to defer to Phase 5.

**Gate:**
- All four parsers extract expected text offline on this Windows box.
- Fixtures committed; baseline suite green and typecheck clean; checkpoint commit made.
- **If a parser fails offline:** stop, choose the documented alternative (e.g., swap `exceljs`, or drop XLSX to fast-follow), amend §3.6, and only then proceed. Do not carry an unverified parser forward.

**Rollback:** revert the dependency commit; nothing else exists yet.

---

### Phase 1 — Foundations (types, config, identity, brain store)

**Objective:** the seams — user tier, citation kinds, cookie identity, and a brain-store module with the safety machinery (atomic writes, mutex, LRU) — with zero visible behavior change.

**Read list:** `lib/rag/types.ts`, `lib/rag/config.ts`, `lib/log.ts`, `app/api/artifact/route.ts`, `.gitignore`, `tests/rag/retriever-integration.test.ts` (for the temp-dir + fake-embedder pattern).

**Steps:**
1. **Characterization first:** add `tests/brain/characterization.test.ts` pinning today's `/api/artifact` behavior (shape + mock output for two fixed queries, no brain). These stay green for the rest of the project.
2. Extend `lib/rag/types.ts`: `Tier` adds `"user"`; `ChunkMeta` adds optional `sourceId`; a `CitationKind` type and extended citation shape (kept backward-compatible — `kind` optional so existing consumers compile unchanged).
3. Add §3.7 constants to `lib/rag/config.ts` following its existing `num`/`bool` env pattern.
4. Create `middleware.ts` per §3.1 (scoped matcher, cookie guarantee, request-header forward). Verify no cookie is set on unmatched routes.
5. Create `lib/brain/store.ts` — the ONLY module that touches `data/brains/**`: brainId validation (UUID form), dir layout creation, manifest read/write, **atomic write helper** (temp + rename), **per-brain promise-queue mutex**, loaded-delta **LRU**, `eraseBrain`, and empty-brain fast path (no dir → no delta). No retrieval logic here.
6. Append `data/brains/` to `.gitignore`.
7. Wire nothing into the app yet (the API stays unaware) — this phase is pure substrate.

**Files:** new `middleware.ts`, `lib/brain/store.ts`, `tests/brain/{characterization,store}.test.ts`; modified `lib/rag/types.ts`, `lib/rag/config.ts`, `.gitignore`.

**Tests (this phase):** store unit tests — create/load/erase; atomic write leaves either old or new file under an injected mid-write crash; mutex serializes two interleaved writes; LRU evicts; invalid brainId rejected. Middleware test if cheap (else covered in Phase 4's route tests).

**Gate:** typecheck clean · full suite green (baseline + new) · dev server boots and the `q4np-brain` cookie appears on `/` but not on e.g. `/legal/disclaimer` · characterization tests green · checkpoint commit.

**Rollback:** all additive; revert the phase commit.

---

### Phase 2 — Extraction + vetting (the health check)

**Objective:** every accepted format extracts to markdown locally; every rejection/warn produces a distinct human-readable reason. No writing to brains yet.

**Read list:** `scripts/ingest/classify.ts` (port pattern), `lib/rag/embedder.ts` (cache pattern), `lib/content/tree.ts` + `lib/content/loader.ts` (node targets), fixtures dir.

**Steps:**
1. Create `lib/brain/extract.ts`: type allowlist by extension + sniff; size cap check before parse; binary/NUL detection; UTF-8→latin-1 fallback; per-format extraction (lazy `import()` of the four parsers; CSV/TSV → markdown table with row cap; JSON → pretty text with depth/size cap; HTML → markdown via turndown; MD frontmatter stripped via `gray-matter`). Output: `{title, markdown, meta}` or a typed failure `{code, message}`. Every §5 pathological case maps to a distinct `code`.
2. Create `lib/brain/healthCheck.ts`: port `extractTitleAndLead` usage + cosine-vs-topic-targets from `classify.ts` into a runtime function. Topic-target vectors computed once and cached to `data/node-targets.bin` (+ json meta) via the store module. Checks in order: readable → caps → on-topic (`node`/`general`/`off-topic` + confidence + runner-up, thresholds from config) → duplicate (exact content-hash, then near-dup cosine vs existing source probes) → non-English signal (flag with the honest "model is English-centric" wording). Result: `{status: pass|warn|fail, reasons[], suggestedNodeId, confidence, secondBest, isDuplicateOf?, preview, chunkEstimate}`.
3. Keep both modules pure (no brain writes) so they're trivially testable.

**Files:** new `lib/brain/extract.ts`, `lib/brain/healthCheck.ts`, `tests/brain/{extract,health}.test.ts`.

**Tests:** the full fixture matrix — each good format extracts non-empty markdown with a sane title; each pathological fixture returns its specific failure code and message; on-topic equity fixture classifies to a plausible node with the fake embedder; the recipe fixture lands `off-topic`; duplicate pair detected. (Fake embedder everywhere; one optional `describe.skip`-by-default real-model smoke.)

**Gate:** typecheck · full suite green · run the extractors once against the real fixtures via a scratchpad script with network disabled (belt-and-braces re-verify of Phase 0) · checkpoint commit.

**Rollback:** additive modules only.

---

### Phase 3 — Weave engine + ingest jobs + brain API (heuristic path)

**Objective:** the write path — placement (heuristic), append/remove with the alignment invariant, job queue with staged progress, and the brain API routes. After this phase a brain can be built and inspected via API, though retrieval doesn't use it yet.

**Read list:** `scripts/ingest/build.ts` (the `addDoc` ordering to mirror), `lib/rag/chunker.ts`, `scripts/ingest/contextualize.ts`, `lib/brain/store.ts` (own module, from Phase 1).

**Steps:**
1. **Invariant tests first** (`tests/brain/weave-alignment.test.ts`): after any sequence of appends/removes, delta `vectors.bin` rows == `chunks.json` length == lexical ids, and parentIds resolve. Written against the not-yet-existing weave API (TDD) with the fake embedder.
2. Create `lib/brain/placement.ts` (heuristic v1): reuse the chunker's sections; per-section cosine vs topic targets → assign existing nodeId, or `general`, or propose a new `u-<slug>` node when the whole doc is coherent-but-novel (below node threshold, above off-topic floor, sections mutually similar). Returns a placement plan `{sectionIdx → nodeId, newNodes[]}` — same shape the Phase-5 LLM placement will emit (single seam).
3. Create `lib/brain/weave.ts`: execute a plan — chunk (existing chunker with `docId = sourceId`), build embed inputs (existing `buildEmbedInput`), embed (existing embedder; optionally through an `EmbedCache` per brain), then **append atomically under the brain mutex**: extend delta arrays, rewrite the four delta artifacts (temp+rename), update `manifest.json`/`graph.json` (weave edges = source → every node its sections landed in), regenerate `catalog.md`, append `journal.md`. Also `removeSource(sourceId)` (filter + full delta rewrite + graph/catalog update) and produce the **weave report** `{sourceId, perNode counts, newNodes, totalPassages}`.
4. Create `lib/brain/jobs.ts`: in-memory job registry `{jobId → stage, progress, result}` with stages `extracting → vetting → weaving(i/N) → done | needs-review | blocked`; jobs referenced by the routes; completed results persisted into the manifest/journal so a restart loses only in-flight jobs (client sees a clean "please re-upload").
5. Add routes: `POST /api/brain/sources` (formData, batch cap, per-file type/size precheck → spawn jobs), `GET /api/brain/ingest/[jobId]`, `POST /api/brain/ingest/[jobId]/confirm` (add-anyway with optional user-chosen topic / discard), `DELETE /api/brain/sources/[sourceId]`, `GET /api/brain` (manifest + graph JSON; lint fields stubbed), `DELETE /api/brain` (erase with confirm token). All read the cookie; missing/invalid → 400 with reason.
6. Enforce caps here (batch, file, text, passages) with §2.10 messaging.

**Files:** new `lib/brain/{placement,weave,jobs}.ts`, `app/api/brain/route.ts`, `app/api/brain/sources/route.ts`, `app/api/brain/sources/[sourceId]/route.ts`, `app/api/brain/ingest/[jobId]/route.ts` (+ `confirm`), `tests/brain/{weave-alignment,placement,jobs-api}.test.ts`.

**Tests:** alignment invariants (above) · multi-topic fixture doc → sections land on ≥2 different nodeIds · novel-doc fixture → one `u-` node created · concurrent double-upload via two interleaved weave calls → serialized, alignment holds · remove → counts shrink consistently · route tests (supertest-style via route handlers): happy path job lifecycle, cap violations return reasons, confirm/discard both paths, erase requires token.

**Gate:** typecheck · full suite green · manual: `curl`-style upload of two fixtures against the dev server, poll the job to `done`, `GET /api/brain` shows sources + weave edges, delete one, erase works · characterization tests still green (artifact route untouched so far) · checkpoint commit.

**Rollback:** additive; revert phase commit (brains created during testing live under gitignored `data/brains/`, delete freely).

---

### Phase 4 — Retrieval over the wiki + brain-aware answers

**Objective:** questions retrieve against foundation ⊕ delta with neighbour expansion; citations resolve for user content; quoting policy + injection defense in the prompt; answers logged per brain. **The only phase that touches shared retrieval/LLM files — smallest possible diffs.**

**Read list:** `lib/rag/retriever.ts`, `lib/rag/select.ts`, `lib/llm/prompt.ts`, `lib/llm/mock.ts`, `lib/llm/types.ts`, `app/api/artifact/route.ts`, `tests/rag/retriever-integration.test.ts`.

**Steps:**
1. **Extract shared helpers** inside `retriever.ts` (fuse/score/select/expand steps) so `retrieveWith` delegates to them with identical behavior — a pure refactor proven by the untouched existing tests. Then add `retrieveMulti(query, storesList, opts)` composing foundation + delta per §3.4 (offset index space; union hits; same pipeline).
2. Add neighbour expansion as a post-selection step used by `retrieveMulti` (and only it), behind `GRAPH_EXPANSION`: gather candidate neighbours (same-node next-best, `related`-node best via `tree.ts`, same-source siblings), cosine-gate, cap at `NEIGHBOR_LIMIT`, tag chunks `neighbor: true`.
3. `lib/brain/retrieval.ts`: load-or-LRU the brain delta via the store; empty brain → return the foundation-only path (identical to today).
4. **`app/api/artifact/route.ts` (small diff):** read the cookie; brain with sources → `retrieveMulti`, else existing `retrieve`. Append the answer to the brain's `answers.jsonl`. Response shape unchanged; citations now carry `kind`.
5. **Citation resolution (server-side):** map each cited chunk → `{kind, nodeId|sourceId, title}` using tree titles, brain graph titles (`u-` nodes), and source display names. Providers receive/emit these; nothing user-generated is dropped because `getNode` failed (fixes the confirmed gap).
6. **`lib/llm/prompt.ts` rewrite:** quoting now allowed for NASPP + user tiers **with attribution required**; chunks wrapped in explicit data delimiters with the "data, not instructions" rule; `neighbor` chunks listed after primary ones and labeled. Keep the JSON output contract.
7. **`lib/llm/mock.ts` update:** scrape-only path may now include one short attributed excerpt instead of refusing; user-tier chunks are summarized/quoted with attribution; citations flow through the new resolver (no more dropped unknown nodeIds).
8. **`components/ArtifactResult.tsx` (small diff):** chips render by `kind` — topic → article link; source/user-node → `/brain?focus=…`; group *Your sources* vs *Topics*. (The `/brain` page itself arrives in Phase 6; the deep link can 404 gracefully until then — acceptable inside the same feature branch, or feature-flag the chip href to `#` until Phase 6 if committing to master per-phase.)
9. Which existing tests may change: any that assert the exact old `SYSTEM_PROMPT` string or the mock's "isn't reproduced here" scrape copy — update them to the new policy **in the same commit as the policy change**. Alignment/characterization/rag tests must remain untouched and green (characterization pins shape + empty-brain behavior, which is preserved).

**Files:** modified `lib/rag/retriever.ts` (helper extraction + `retrieveMulti`), `app/api/artifact/route.ts`, `lib/llm/{prompt,mock,types}.ts`, `components/ArtifactResult.tsx`; new `lib/brain/retrieval.ts`, `tests/brain/{retrieve-multi,citations,prompt-policy}.test.ts`.

**Tests:** empty brain → `retrieveMulti` output deep-equals `retrieveWith` output (regression) · seeded brain + fake embedder → a query only answerable by an upload surfaces the user chunk and cites it with `kind: "source"` · post-delete the same query no longer surfaces it · neighbour expansion adds a `related`-node passage when slots remain and respects the gate/limit · prompt contains delimiter + injection line · mock emits user citations with correct labels · characterization tests green.

**Gate:** typecheck · **full suite green including all pre-existing `tests/rag/*` untouched** · manual: dev server — empty-brain question behaves exactly as before; upload an equity note; ask its question; answer quotes it with attribution and the chip appears under *Your sources* · checkpoint commit.

**Rollback:** helper extraction is behavior-preserving (proven by tests); the route change is a small guarded branch — revert the phase commit restores today's path.

---

### Phase 5 — LLM maintenance + lint + retention

**Objective:** the "LLM owns the bookkeeping" layer — provider-gated placement upgrade, node summaries, cross-links, the lint engine with cadence, erase/prune retention. Heuristic parity throughout.

**Read list:** `lib/llm/provider.ts`, `lib/llm/groq.ts` (Zod pattern), `lib/brain/{placement,weave,store}.ts` (own modules).

**Steps:**
1. Create `lib/brain/maintain.ts` with a narrow internal interface (e.g., `proposePlacement`, `summarizeNode`, `proposeCrossLinks`, `reviewWiki`) — each: build a bounded prompt (section titles + snippets only, never whole files), call the configured provider, **Zod-validate**, and on any failure return the heuristic result. Budgets from §3.7/§2 (1 placement call per file; ≤10 summary calls per ingest; lint batched ≤3 calls). Injection defense wrapper shared with Phase 4.
2. Upgrade ingest: when a provider is on, `placement.ts` consults `proposePlacement` (same plan shape); vetting attaches the LLM quality judgement to the health report. Mock/offline → identical Phase-3 behavior (parity by construction).
3. Node summaries + cross-links: on weave, refresh summaries only for affected nodes (LLM on) or extractive first-sentences (off); similarity-based cross-link proposals stored as graph edges; auto-apply structural additions, never removals.
4. Create `lib/brain/lint.ts`: heuristic detectors (near-dup source pairs by probe cosine; orphan `u-` nodes/sources with no surviving chunks; off-topic drift — source probe vs its assigned node target below threshold; staleness by age; broken graph references; weak/missing summaries) + LLM contradiction/quality review when on. Findings `{id, type, severity, message, suggestedAction, autoApplicable}` persisted to `lint-report.json`.
5. Cadence: manifest tracks `lastLintAt` + `appendsSinceLint`; `GET /api/brain` triggers an async lint when ≥ `LINT_APPEND_THRESHOLD` appends or > `LINT_STALE_DAYS` days; `POST /api/brain/lint` on demand; `POST /api/brain/lint/apply` applies an auto-applicable finding or records dismissal; destructive suggestions only ever *suggest* (removal executes through the existing delete endpoint after user confirm).
6. Retention: `scripts/brain/prune.ts` + npm script `brains:prune` (delete brains untouched > N days, dry-run by default); wire `DELETE /api/brain` erase already present from Phase 3 into docs.

**Files:** new `lib/brain/{maintain,lint}.ts`, `scripts/brain/prune.ts`, `tests/brain/{maintain-parity,lint}.test.ts`; modified `lib/brain/{placement,weave}.ts` (consult maintain), `app/api/brain/route.ts` (+ lint endpoints), `package.json` (script).

**Tests:** with `LLM_PROVIDER=mock`, every maintain operation returns valid structured output (parity) · a stub provider returning garbage → Zod rejects → heuristic result, no throw · planted near-dup pair flagged · planted orphan flagged · drift fixture flagged · cadence triggers exactly at thresholds (manifest math unit-tested) · apply/dismiss round-trips · prune dry-run vs real run on temp dirs.

**Gate:** typecheck · full suite green · manual: seed a brain with a duplicate + an orphan, hit lint, see findings, apply a cross-link fix, confirm a removal flows through delete · with a real key (if available) one placement/lint call sanity-checked, otherwise stub-provider test stands in · checkpoint commit.

**Rollback:** all additive on top of Phase 3/4 seams.

---

### Phase 6 — UI: /brain page, ingest experience, the interactive graph

**Objective:** the flagship surface — upload with staged progress and weave reports, the sources table, lint UI, the SVG graph with backlink provenance, nav + chat strip. Mobile-ready.

**Read list:** `components/AppShell.tsx`, `app/generate/client.tsx`, `components/ArtifactResult.tsx`, `app/layout.tsx` (shell/tokens), one portal page for styling patterns (`app/browse/page.tsx`).

**Steps:**
1. `lib/brain/graph.ts` (server): compose the render model — foundation (pillars/topics/`general` from `tree.ts`, tree + `related` edges) ⊕ brain (`u-` nodes, source satellites, weave edges, summaries, backlinks incl. `answers.jsonl` citations). **Deterministic radial layout computed here** (pillar ring → topic fans → source satellites; id-hash jitter; no randomness at render).
2. `app/brain/page.tsx` (server: cookie → manifest/graph props; disclaimer + noindex) + `app/brain/client.tsx` (state, polling, panel/bottom-sheet logic).
3. Components under `components/brain/`: `UploadDropzone` (drag-drop + browse, multi-file, accepted-format hint, 16px/44px), `IngestQueue` (per-file cards: staged progress → weave report with per-node links / warn card with reasons + *Add anyway* (topic picker) + *Discard* / fail card), `SourceTable` (name, type, topics, passages, health, date, view/delete with confirm), `BrainStats` (counts, last health check, Run-health-check, Erase with confirm), `LintPanel` (findings grouped, apply/dismiss), `BrainGraph` (dependency-free SVG per §"graph" below), `NodePanel` (summary, feeding sources, backlinks, "Ask about this" → `/generate?nodeId=`).
4. **Graph spec:** pan (pointer drag → viewBox), zoom (wheel/pinch), hover = highlight 1-hop + dim rest, click = select → panel, enlarged invisible hit circles (≥44px), `?focus=<ids>` pulses cited nodes, search-to-focus, fit button, legend. Visual language: foundation muted (`--surface-2`/`--border` tokens), user content teal (`--accent`), node radius ∝ passage count, solid tree edges / dashed `related` / teal weave edges. List-view toggle as the accessibility/mobile fallback.
5. Nav: add "My Brain" to `navLinks` + drawer in `AppShell.tsx`. Chat strip in `app/generate/client.tsx`: "Answering from your wiki · N sources" (fetch count once via `GET /api/brain`, cheap) → links `/brain`. Citation chips from Phase 4 now resolve to the live page.
6. Keep ALL rendering element-based (§2.6) — summaries, quotes, file names.

**Files:** new `lib/brain/graph.ts`, `app/brain/{page,client}.tsx`, `components/brain/*` (7 components), `tests/brain/graph-model.test.ts`; modified `components/AppShell.tsx`, `app/generate/client.tsx`.

**Tests:** graph-model unit tests (node/edge counts for a seeded brain; layout determinism — same input → same positions; backlinks include an answer citation) · component smoke tests only where cheap; the heavy verification is E2E below.

**Gate (manual E2E via preview tools, text-first):** typecheck · full suite green · dev server: upload 3 files of different formats → staged progress visible → weave report links focus the graph → source appears as teal satellite connected to its topics → ask a question → answer chips split, clicking a source chip opens `/brain?focus=…` and the node pulses → warn-path file shows reasons and *Add anyway* works → delete removes the node live → lint button produces findings UI → erase empties the page to the foundation-only state → mobile viewport (preview resize): bottom sheet, pinch targets, list toggle · checkpoint commit.

**Rollback:** UI is additive; nav diff is two lines.

---

### Phase 7 — Docs, hardening, final acceptance

**Objective:** policy docs match reality; the whole feature demonstrated end-to-end; the suite is the safety net for the future.

**Read list:** `CLAUDE.md`, `.env.example` (if present), `SPEC-BRAIN.md` (this file).

**Steps:**
1. **CLAUDE.md:** rewrite rules #5/#10 to the new quoting policy (quote NASPP + user sources with attribution; scrape-tier no longer non-verbatim — note the NASPP-authorization assumption); add a "Second Brain" section (user tier, `data/brains/`, formats, caps, LLM-maintenance provider-gating, new config constants, `brains:prune`); update the phase banner to reference SPEC-BRAIN.
2. Update `.env.example` with the new §3.7 vars (commented defaults).
3. Flip this spec's status header to "implemented"; record any deviations made during build (each with its why).
4. Sweep: every new page/panel carries the disclaimer + noindex; every input 16px; every target ≥44px; no `dangerouslySetInnerHTML` (`rg` check); no new network calls at runtime (`rg` for fetch/https in `lib/brain` — only LLM provider paths allowed); `data/brains/` ignored (`git status` clean after a test upload).
5. **Final acceptance run** (the §7 checklist below) in the preview browser, including one screenshot for the record.
6. Final commit (and PR if the workflow calls for one).

**Gate = final acceptance:**
- Offline mock boot; empty-brain chat byte-equivalent to baseline (characterization green).
- Upload MD + PDF + DOCX + XLSX → progress → weave reports; multi-topic doc feeds ≥2 nodes; novel doc creates a `u-` node; recipe warns with reason; scanned PDF fails with the OCR message; 11-file batch rejected with the cap message.
- Upload-only question → quoted, attributed answer; chip pulses the graph node. NASPP-grounded answer may quote with attribution. Nonsense → honest fallback (unchanged).
- Delete + erase behave; lint catches planted dupe/orphan/contradiction; apply/dismiss works; prune dry-runs.
- Two simultaneous uploads → no corruption (alignment test + manual).
- `npx tsc --noEmit` clean; `npm test` fully green (baseline 241 + all new); no gitignore leaks.

---

## 7. Out of scope (v1) / future

Accounts/login (identity seam ready) · cross-user sharing · editing the foundation corpus · autonomous destructive edits · ANN vector index (interface seam ready) · at-rest encryption · URL/paste ingest · OCR for scanned PDFs · RTF/.doc · streaming answers.

## 8. Open items

1. **NASPP verbatim quoting** — implemented per user direction; confirm it sits within the NASPP authorization/license before any external demo.
2. XLSX parser choice locked to `exceljs` pending the Phase-0 offline spike; §3.6 records the fallback decision path if the spike fails.
