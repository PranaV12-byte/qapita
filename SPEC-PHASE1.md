# Phase 1 — RAG Chatbot Demo

> Goal: working equity-comp RAG chatbot with real embeddings, real retrieval, real content.
> No hardcoded responses — the full pipeline works end-to-end as it will in the MVP.
> Browse/glossary/search/start-here/29 stub articles are Phase 2 — do NOT build them now.
>
> **How to implement:** one Claude Code session per step. Prompt = "Read SPEC-PHASE1.md, implement Step N."
> Each step is self-contained. Do NOT skip ahead or implement later steps.
>
> **Testing rule:** every step includes tests. Write them, run them, and fix failures before
> marking the step complete. Use Vitest for unit/integration tests. Run `npm test` at the end
> of every step — it must pass. Tests from prior steps must continue to pass (never break them).

---

## Step 1: Scaffold

**What to build:** project skeleton, dark theme, layout shell, placeholder pages, and scaffold tests.

1. Run `create-next-app` with App Router, TypeScript strict, Tailwind, eslint.
2. Install production deps: `next-mdx-remote`, `gray-matter`, `zod`, `minisearch`, `@react-pdf/renderer`.
3. Install dev deps: `@xenova/transformers`, `tsx`, `fast-glob`, `vitest`.
4. Set up fonts via `next/font/google`: Instrument Serif weight 400, Inter weights 400 and 500.
5. Create `globals.css` with CSS custom properties from CLAUDE.md (all the `--bg`, `--surface-*`, `--text-*`, `--accent-*`, `--draft`, `--certified`, `--danger` tokens).
6. Wire tokens into `tailwind.config.ts` so they're usable as Tailwind classes (e.g., `bg-surface-1`, `text-heading`, `text-accent`).
7. Build root `layout.tsx`:
   - Fonts applied.
   - `<meta name="robots" content="noindex">` in head.
   - `<body>` gets `bg-bg text-body` (dark background, light text).
   - Renders `{children}` + footer disclaimer: "This is an AI-generated draft that has not been reviewed by a professional. It is educational only and is not tax, legal, or investment advice. US only."
8. Build `DraftStrip` component: persistent ~32px strip, dark background (`surface-2`), text: "Draft — AI-generated, not reviewed · Educational only, not advice". The word "Draft" is amber (`--draft`), rest is muted. Whole strip links to `/legal/disclaimer`. Not dismissible. Renders on every page.
9. Build `AppShell` component: top bar with wordmark "Q4N$P" in Instrument Serif. Bottom tab bar with 4 tabs: Home, Browse, Generate, Glossary. Active tab uses accent color. Tabs link to `/`, `/browse`, `/generate`, `/glossary`. Tap targets ≥ 44×44px.
10. Create `.env.example`:
    ```
    LLM_PROVIDER=mock
    GROQ_API_KEY=
    ANTHROPIC_API_KEY=
    RETRIEVAL_FALLBACK_THRESHOLD=0.35
    MOCK_DELAY=true
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```
11. Home page (`/`): centered hero — Instrument Serif heading "Equity compensation, explained.", Inter subtext "AI-powered reference for stock plan professionals.", accent-colored button "Ask a question →" linking to `/generate`.
12. Create placeholder pages that render centered "Coming soon" in muted text:
    `/browse`, `/p/[pillar]/page.tsx`, `/a/[pillar]/[slug]/page.tsx`, `/start-here`, `/glossary`, `/glossary/[term]`, `/search`.
13. Create `/generate/page.tsx` — for now just render "Generate page — coming in Step 5" as placeholder.
14. Create `/legal/disclaimer/page.tsx` — render the full disclaimer text.
15. Set up Vitest config (`vitest.config.ts`) and add `"test": "vitest run"` to package.json scripts.

### Step 1 tests

Write `tests/scaffold.test.ts`:

```ts
// 1. CSS tokens exist in globals.css
// Read globals.css and verify it contains every required CSS custom property:
// --bg, --surface-1, --surface-2, --border, --border-strong,
// --text-head, --text-primary, --text-body, --text-muted,
// --accent, --accent-solid, --accent-on, --accent-line,
// --draft, --certified, --danger
// Each must have the exact hex value from CLAUDE.md.

// 2. Tailwind config maps tokens
// Import tailwind config and verify the theme extension includes
// colors/backgrounds that reference the CSS variables.

// 3. .env.example exists and contains all required vars
// Read .env.example, verify it contains: LLM_PROVIDER, GROQ_API_KEY,
// ANTHROPIC_API_KEY, RETRIEVAL_FALLBACK_THRESHOLD, MOCK_DELAY, NEXT_PUBLIC_SITE_URL

// 4. noindex meta tag
// Read app/layout.tsx and verify it contains <meta name="robots" content="noindex">

// 5. DraftStrip contains exact microcopy
// Import or read DraftStrip component, verify it contains the exact string:
// "Draft — AI-generated, not reviewed · Educational only, not advice"

// 6. Footer disclaimer exact text
// Verify layout.tsx or a footer component contains:
// "This is an AI-generated draft that has not been reviewed by a professional.
//  It is educational only and is not tax, legal, or investment advice. US only."

// 7. All route files exist
// Verify these files exist on disk (use fs):
// app/page.tsx, app/browse/page.tsx, app/generate/page.tsx,
// app/glossary/page.tsx, app/search/page.tsx, app/start-here/page.tsx,
// app/legal/disclaimer/page.tsx, app/p/[pillar]/page.tsx,
// app/a/[pillar]/[slug]/page.tsx, app/glossary/[term]/page.tsx

// 8. No NASPP marks
// Read all .tsx files in app/ and components/, grep for "NASPP" — must be zero hits.
```

### Step 1 verification (run manually after tests pass)

```bash
npm run dev          # must start without errors
npm run build        # must build without errors  
npm test             # tests/scaffold.test.ts passes
npx tsc --noEmit     # no type errors
```

Open browser and visually confirm:
- `http://localhost:3000` — dark background, Instrument Serif heading, accent button
- `http://localhost:3000/generate` — placeholder text visible
- `http://localhost:3000/browse` — "Coming soon" visible
- `http://localhost:3000/legal/disclaimer` — disclaimer text visible
- DraftStrip visible on all pages
- Footer disclaimer visible
- Bottom tabs navigate between pages

---

## Step 2: Content infrastructure + 12 flagship articles

**What to build:** Zod schema, content tree manifest, MDX loader, 12 full-length articles, and content tests.

**Prerequisite:** Step 1 complete (`npm test` passes).

### 2A. Content infrastructure

1. Create `lib/content/schema.ts` — Zod schema for MDX frontmatter:
   ```ts
   const ArticleSchema = z.object({
     id: z.string(),                    // e.g. "1.1"
     pillar: z.number().int().min(1).max(7),
     slug: z.string(),
     title: z.string(),
     status: z.enum(["generated", "signed_off"]),
     audience: z.array(z.enum(["admin", "participant"])),
     summaryPlain: z.string(),          // may be empty string
     sources: z.array(z.object({
       label: z.string(),
       url: z.string().url().optional(),
     })),
     reviewedBy: z.string().nullable(),
     faqs: z.array(z.object({ q: z.string(), a: z.string() })),
     updatedAt: z.string(),             // ISO date
     related: z.array(z.string()),
   });
   ```

2. Create `lib/content/tree.ts` — static manifest of all 41 nodes. Export:
   ```ts
   type TreeNode = { id: string; pillar: number; slug: string; title: string; pillarSlug: string; };
   type Pillar = { id: number; title: string; slug: string; nodes: TreeNode[]; };
   export const PILLARS: Pillar[];
   export const ALL_NODES: TreeNode[];
   export function getNode(id: string): TreeNode | undefined;
   export function getPillar(slug: string): Pillar | undefined;
   ```
   Full tree (all 41 nodes — the manifest is needed even though only 12 have articles now):
   ```
   1 "Award types & mechanics" slug:"awards"
     1.1 "Incentive stock options (ISOs)" slug:"isos"
     1.2 "Non-qualified stock options (NSOs)" slug:"nsos"
     1.3 "RSUs & RSAs" slug:"rsus-rsas"
     1.4 "Employee stock purchase plans (ESPPs)" slug:"espps"
     1.5 "Performance share units (PSUs)" slug:"psus"
     1.6 "SARs & phantom equity" slug:"sars-phantom"
     1.7 "Dividends & dividend equivalents" slug:"dividends"
   2 "Equity lifecycle" slug:"lifecycle"
     2.1 "Grant & acceptance" slug:"grant-acceptance"
     2.2 "Vesting" slug:"vesting"
     2.3 "Exercise" slug:"exercise"
     2.4 "Settlement & release" slug:"settlement-release"
     2.5 "Liquidity & exits" slug:"liquidity-exits"
   3 "Tax & withholding" slug:"tax"
     3.1 "Option taxation (ISO/NSO, AMT)" slug:"option-taxation"
     3.2 "RSU & ESPP tax" slug:"rsu-espp-tax"
     3.3 "Capital gains, holding periods & 83(b)" slug:"cap-gains-83b"
     3.4 "Payroll & withholding mechanics" slug:"payroll-withholding"
     3.5 "Multistate & mobility" slug:"multistate-mobility"
     3.6 "Cost basis & reporting" slug:"cost-basis-reporting"
     3.7 "Section 409A deferred compensation" slug:"section-409a"
     3.8 "280G golden parachute" slug:"280g-golden-parachute"
   4 "Equity accounting (ASC 718)" slug:"accounting"
     4.1 "Grant-date fair value" slug:"grant-date-fv"
     4.2 "Expense recognition & forfeitures" slug:"expense-forfeitures"
     4.3 "Modifications" slug:"modifications"
     4.4 "EPS & dilution" slug:"eps-dilution"
   5 "Securities law" slug:"securities-law"
     5.1 "SEC registration, Rule 701 & Form S-8" slug:"sec-rule701-s8"
     5.2 "Section 16 & Forms 3/4/5" slug:"section-16"
     5.3 "10b5-1 plans & blackout windows" slug:"10b5-1-blackouts"
     5.4 "Proxy & executive compensation" slug:"proxy-exec-comp"
     5.5 "10-K / 10-Q equity disclosures" slug:"10k-10q"
     5.6 "Year-end IRS filings (W-2, 3921, 3922)" slug:"year-end-filings"
     5.7 "Rule 144 & resale restrictions" slug:"rule-144"
   6 "Plan design" slug:"plan-design"
     6.1 "Plan design & share pool sizing" slug:"design-pool-sizing"
     6.2 "Share reserve & award limits" slug:"share-reserve-limits"
     6.3 "Award design trends" slug:"award-design-trends"
     6.4 "Benchmarking" slug:"benchmarking"
     6.5 "409A valuations & fair market value" slug:"409a-valuations"
   7 "Admin & operations" slug:"admin-ops"
     7.1 "Day-to-day plan administration" slug:"day-to-day-admin"
     7.2 "Participant communications" slug:"participant-comms"
     7.3 "Job & life events" slug:"job-life-events"
     7.4 "Advisor & broker coordination" slug:"advisor-broker"
     7.5 "Compliance calendar" slug:"compliance-calendar"
   ```

3. Create `lib/content/loader.ts`:
   ```ts
   export async function loadArticle(pillarSlug: string, slug: string): Promise<{frontmatter, content}>;
   export async function loadAllArticles(): Promise<{frontmatter, content}[]>;
   ```
   Reads from `content/pillars/<pillarSlug>/<slug>.mdx`, parses with gray-matter, validates with Zod. Returns only articles that exist on disk (does not error on missing stubs).

4. Create directory structure: `content/pillars/awards/`, `content/pillars/lifecycle/`, `content/pillars/tax/`, `content/pillars/accounting/`, `content/pillars/securities-law/`, `content/pillars/plan-design/`, `content/pillars/admin-ops/`.

### 2B. Write 12 flagship articles (800–1200 words each)

These 12 nodes cover all 8 demo scenarios. Write them as MDX files with:
- Valid frontmatter per the Zod schema. `status: "generated"`, `reviewedBy: null`.
- 3 FAQs with real, useful Q&A pairs.
- A `summaryPlain` field with a 2-3 sentence plain-language summary.
- Sources citing primary authorities (IRC sections, ASC 718, SEC rules, IRS forms).
- `related` field linking to 2-3 related node IDs.
- Body text: 800-1200 words of real equity-comp content. Own words, grounded in primary authorities. Never paraphrase myStockOptions.
- `updatedAt: "2026-07-12"`.

The 12 files:
1. `content/pillars/awards/isos.mdx` — id "1.1", Incentive stock options
2. `content/pillars/awards/nsos.mdx` — id "1.2", Non-qualified stock options
3. `content/pillars/awards/rsus-rsas.mdx` — id "1.3", RSUs & RSAs
4. `content/pillars/awards/espps.mdx` — id "1.4", ESPPs
5. `content/pillars/lifecycle/vesting.mdx` — id "2.2", Vesting
6. `content/pillars/lifecycle/exercise.mdx` — id "2.3", Exercise
7. `content/pillars/tax/option-taxation.mdx` — id "3.1", Option taxation (ISO/NSO, AMT)
8. `content/pillars/tax/rsu-espp-tax.mdx` — id "3.2", RSU & ESPP tax
9. `content/pillars/tax/cap-gains-83b.mdx` — id "3.3", Capital gains, holding & 83(b)
10. `content/pillars/securities-law/10b5-1-blackouts.mdx` — id "5.3", 10b5-1 & blackouts
11. `content/pillars/plan-design/design-pool-sizing.mdx` — id "6.1", Plan design & pool sizing
12. `content/pillars/admin-ops/job-life-events.mdx` — id "7.3", Job & life events

### Step 2 tests

Write `tests/content.test.ts`:

```ts
// 1. Tree manifest completeness
// - PILLARS has exactly 7 entries
// - ALL_NODES has exactly 41 entries
// - Every node has a unique id, slug, title, pillarSlug
// - getNode("1.1") returns the ISOs node
// - getNode("99.9") returns undefined
// - getPillar("awards") returns pillar 1 with 7 nodes
// - getPillar("nonexistent") returns undefined
// - Pillar slugs are exactly: awards, lifecycle, tax, accounting, securities-law, plan-design, admin-ops

// 2. Zod schema rejects bad frontmatter
// - Missing required field (e.g., no title) → throws ZodError
// - Invalid status "reviewed" → throws (only "generated" | "signed_off" allowed)
// - Invalid audience "manager" → throws (only "admin" | "participant" allowed)
// - pillar: 0 → throws (min 1), pillar: 8 → throws (max 7)
// - Valid frontmatter passes without error

// 3. Content loader loads all 12 flagship articles
// - loadAllArticles() returns exactly 12 items
// - Each has valid frontmatter (passes Zod)
// - Each has non-empty content (body text > 500 chars)
// - No duplicate IDs across articles

// 4. Content loader validates every article against schema
// For each of the 12 articles:
// - frontmatter.id matches expected (e.g., "1.1" for isos)
// - frontmatter.slug matches filename (e.g., "isos")
// - frontmatter.status === "generated"
// - frontmatter.reviewedBy === null
// - frontmatter.faqs has exactly 3 entries
// - Each FAQ has non-empty q and a strings
// - frontmatter.sources has at least 1 entry
// - Each source has a non-empty label
// - frontmatter.related has at least 1 entry
// - Every related ID exists in ALL_NODES (no broken references)
// - frontmatter.audience includes at least one of "admin" | "participant"

// 5. Content quality checks
// For each of the 12 articles:
// - Body content is between 800-1200 words (split on whitespace, count)
// - Body does not contain "lorem ipsum" (case-insensitive)
// - Body does not contain "TODO" or "FIXME"
// - Body does not contain "myStockOptions" or "mystockoptions" (never paraphrase)
// - Body does not contain "NASPP" (no NASPP marks)

// 6. Article-to-tree consistency
// - Every article's frontmatter.id exists in ALL_NODES
// - Every article's frontmatter.pillar matches its tree node's pillar
// - Every article's frontmatter.slug matches its tree node's slug
```

### Step 2 verification

```bash
npm test             # tests/scaffold.test.ts AND tests/content.test.ts both pass
npx tsc --noEmit     # no type errors
```

---

## Step 3: Embeddings + retrieval index + retriever + scenarios

**What to build:** real embedding pipeline, vector index, retriever with cosine similarity + reranking, 8 scenario definitions, and retrieval tests.

**Prerequisite:** Step 2 complete (`npm test` passes with scaffold + content tests).

### 3A. Embedding provider
Create `lib/embeddings/provider.ts`:
- Import `pipeline` from `@xenova/transformers`.
- Singleton class `EmbeddingProvider`:
  - Loads `Xenova/all-MiniLM-L6-v2` once (feature-extraction pipeline).
  - Model cached under `node_modules/.cache/@xenova/transformers`.
  - `async embed(text: string): Promise<Float32Array>` — returns 384-dim vector.
  - `async embedBatch(texts: string[]): Promise<Float32Array[]>`.
- Export a singleton getter: `getEmbedder()`.

### 3B. Index builder
Create `scripts/ingest/build-indexes.ts` (run via `npm run build:index`):
1. Load all MDX files that exist via the content loader (currently 12, more later).
2. Chunk each article body: 1,000 chars max, 150 char overlap, split on paragraph boundaries (double newline). Each chunk gets metadata: `{tier: "curated", nodeId: string, headingPath: string, text: string}`.
3. Build scenario entries: for each of the 8 scenarios (from `lib/scenarios.ts`), join `label + keywords` into a single string. Mark as `{isScenario: true, scenarioId: string}`.
4. Embed all chunks + scenario entries using EmbeddingProvider.
5. Write `data/vectors.bin` — raw Float32Array buffer, 384 floats per entry, row order matches chunks.json index.
6. Write `data/chunks.json` — JSON array of chunk/scenario metadata (same order as vectors.bin rows).
7. Add `data/vectors.bin` and `data/chunks.json` to `.gitignore`.
8. Add scripts to package.json:
   - `"build:index": "tsx scripts/ingest/build-indexes.ts"`
   - Update `"build"` to: `"npm run build:index && next build"`

### 3C. Retriever
Create `lib/retrieval/constants.ts`:
```ts
export const CURATED_WEIGHT = 1.0;
export const SCRAPE_WEIGHT = 0.7;
export const NODE_BOOST = 1.5;
export const TOP_K = 8;
export const SCRAPE_CAP = 3;
export const FALLBACK_THRESHOLD = parseFloat(process.env.RETRIEVAL_FALLBACK_THRESHOLD || "0.35");
```

Create `lib/retrieval/retriever.ts`:
- On first call: load `data/vectors.bin` into a Float32Array and `data/chunks.json` into memory. Cache both.
- `async retrieve(query: string, nodeId?: string)`:
  1. Embed query via EmbeddingProvider.
  2. Compute cosine similarity of query vector against every non-scenario row in vectors.bin.
  3. For each chunk: `finalScore = cosine × tierWeight`. If nodeId matches chunk's nodeId, multiply by NODE_BOOST (1.5).
  4. Sort by finalScore descending. Take top TOP_K (8). Cap scrape-tier at SCRAPE_CAP (3).
  5. Fallback check: if best curated-tier cosine < FALLBACK_THRESHOLD (0.35) OR fewer than 2 results → `fallbackUsed = true`. Find nearest scenario by cosine(queryVec, scenarioVec) over scenario entries in the index.
  6. Return `{ chunks: RetrievalChunk[], fallbackUsed: boolean, fallbackScenario?: { id, label } }`.

### 3D. Scenarios
Create `lib/scenarios.ts`:
- Export `SCENARIOS` array with 8 entries:
  ```ts
  type Scenario = {
    id: string;
    label: string;           // full problem statement shown as chip text
    keywords: string[];       // for embedding
    nodeIds: string[];        // which tree nodes this covers
  };
  ```
  The 8 scenarios:
  1. `rsu-vesting-tax` — "How RSU vesting and tax withholding work" — nodes ["1.3", "3.2", "3.4"]
  2. `iso-exercise-amt` — "ISO exercise decisions and AMT impact" — nodes ["1.1", "3.1", "3.3"]
  3. `espp-enrollment` — "ESPP enrollment explained for new hires" — nodes ["1.4", "3.2"]
  4. `double-trigger-ipo` — "Double-trigger RSU vesting at IPO" — nodes ["1.3", "2.5"]
  5. `post-termination` — "What happens to your equity when you leave" — nodes ["2.3", "7.3"]
  6. `10b5-1-blackouts` — "Setting up a 10b5-1 plan and navigating blackout windows" — nodes ["5.3", "5.2"]
  7. `83b-election` — "Filing an 83(b) election: deadline and process" — nodes ["1.3", "3.3"]
  8. `year-end-reporting` — "Year-end equity reporting checklist (W-2, 3921, 3922)" — nodes ["5.6", "3.6"]

  NOTE: no canned artifacts. The chatbot will retrieve real chunks and generate responses every time, even for scenario clicks. Scenario chips just pre-fill the query with the label text.

### Step 3 tests

Write `tests/retrieval.test.ts` — **unit tests (mock the EmbeddingProvider, do NOT load MiniLM)**:

```ts
// Use a mock EmbeddingProvider that returns deterministic fixed vectors.
// This keeps tests fast (<1s) and avoids downloading the model in CI.

// 1. Chunker tests
// - A 2,500 char text produces 3 chunks (1000/1000/500+overlap)
// - Chunks split on paragraph boundaries (double newline)
// - Each chunk is ≤ 1,000 chars
// - Overlap: last 150 chars of chunk N appear at start of chunk N+1
// - A 500 char text produces 1 chunk (no split needed)
// - Empty text produces 0 chunks

// 2. Cosine similarity
// - cos(v, v) === 1.0 (identical vectors)
// - cos(v, -v) === -1.0 (opposite vectors)
// - cos(v, orthogonal) === 0.0
// - cos(zero_vector, v) === 0.0 (no division by zero crash)

// 3. Curated outranks scrape at equal cosine
// Given two chunks with identical cosine to the query:
//   curated chunk finalScore = cosine × 1.0
//   scrape chunk finalScore = cosine × 0.7
// → curated chunk ranks higher

// 4. nodeId boost works
// Given a chunk for nodeId "1.3" and a query with nodeId="1.3":
//   boosted score = cosine × 1.0 × 1.5
// → it ranks higher than an unboosted chunk with the same cosine

// 5. Top-k = 8 enforced
// Given 20 chunks, retrieve returns at most 8

// 6. Scrape cap = 3 enforced
// Given 10 scrape + 10 curated chunks, at most 3 scrape-tier in result

// 7. Fallback triggers when best curated cosine < 0.35
// Mock embeddings so best curated cosine = 0.30
// → fallbackUsed === true, fallbackScenario is populated

// 8. Fallback triggers when fewer than 2 results
// Mock embeddings so only 1 chunk exceeds a minimum score
// → fallbackUsed === true

// 9. No fallback when curated cosine ≥ 0.35 and ≥ 2 results
// → fallbackUsed === false, fallbackScenario === undefined

// 10. Retrieval constants match spec
// - CURATED_WEIGHT === 1.0
// - SCRAPE_WEIGHT === 0.7
// - NODE_BOOST === 1.5
// - TOP_K === 8
// - SCRAPE_CAP === 3
// - FALLBACK_THRESHOLD === 0.35 (default)
```

Write `tests/retrieval-integration.test.ts` — **integration test (loads real MiniLM, slower)**:

```ts
// This test actually loads the MiniLM model and runs real embeddings.
// Mark with a timeout of 60s since first run downloads the model.

// 1. Embedding dimensions
// - embed("test string") returns Float32Array of length 384

// 2. Semantic similarity is meaningful
// - cosine(embed("RSU vesting"), embed("restricted stock unit vesting schedule")) > 0.7
// - cosine(embed("RSU vesting"), embed("Belgian chocolate recipe")) < 0.3

// 3. Index build + retrieval end-to-end
// - Run build-indexes (or its core logic) against the 12 real articles
// - vectors.bin and chunks.json are created
// - chunks.json has entries for all 12 articles + 8 scenarios
// - vectors.bin has the right number of rows (chunks.length × 384 floats)
// - Query "How are RSUs taxed?" returns chunks from node 1.3 and/or 3.2 in top results
// - Query "ISO exercise AMT" returns chunks from node 1.1 and/or 3.1 in top results
// - Query "Belgian stock option taxation" triggers fallbackUsed === true

// 4. Scenario matching
// - Each of the 8 scenario labels, when used as a query, retrieves chunks
//   from at least one of that scenario's nodeIds in the top results
// - e.g., "How RSU vesting and tax withholding work" should return chunks
//   from nodes 1.3, 3.2, or 3.4
```

Write `tests/scenarios.test.ts`:

```ts
// 1. Exactly 8 scenarios
// - SCENARIOS.length === 8

// 2. Every scenario has required fields
// For each scenario:
// - id is a non-empty string
// - label is a non-empty string (at least 10 chars — it's a full problem statement)
// - keywords is a non-empty array of strings
// - nodeIds is a non-empty array of strings
// - Every nodeId in the scenario exists in ALL_NODES

// 3. Unique IDs
// - All scenario IDs are unique

// 4. No canned artifacts
// - Scenarios do NOT have a cannedArtifact property (confirm the type doesn't include it)
```

### Step 3 verification

```bash
npm run build:index  # completes without errors, creates data/vectors.bin + data/chunks.json
npm test             # all tests pass (scaffold + content + retrieval + scenarios)
npx tsc --noEmit     # no type errors
```

Also verify manually:
- `data/vectors.bin` exists and is > 0 bytes
- `data/chunks.json` exists, is valid JSON, contains entries with `tier: "curated"` and entries with `isScenario: true`
- Count of chunks.json entries matches vectors.bin size (fileSize / 4 / 384)

---

## Step 4: LLM providers + API routes + logging

**What to build:** the generation layer that takes retrieved chunks and produces artifact responses, plus all API endpoints and their tests.

**Prerequisite:** Step 3 complete (`npm test` passes, `npm run build:index` works).

### 4A. LLM provider interface
Create `lib/llm/provider.ts`:
```ts
export type ArtifactResult = {
  title: string;
  bodyMarkdown: string;
  citations: { nodeId: string; title: string }[];
  quickShare: string;
};

export interface LLMProvider {
  generate(query: string, chunks: RetrievalChunk[]): Promise<ArtifactResult>;
}

// Returns mock/groq/anthropic based on LLM_PROVIDER env var
export function getLLMProvider(): LLMProvider;
```

### 4B. MockLLM
Create `lib/llm/mock.ts`:
- Assembles a response from the retrieved chunks (NOT hardcoded):
  - `title`: `Reference: {query truncated to 80 chars}`
  - `bodyMarkdown`:
    ```
    Here's a working reference for: {query}

    ## What this covers
    {lead sentence of each top curated chunk, as a bulleted list}

    ## Key points
    1. {first two sentences of curated chunk #1}
    2. {first two sentences of curated chunk #2}
    ... up to 5 points, one per distinct curated-tier chunk in rank order

    ## Cited topics
    - {node title for each cited nodeId}
    ```
  - `citations`: deduped `{nodeId, title}` from used chunks (look up title from tree.ts).
  - `quickShare`: title + numbered key points as plaintext.
- Mock NEVER uses scrape-tier chunk text in output (ranking only).
- Simulated latency: `1200 + (Math.random() * 600 - 300)` ms, skipped if `MOCK_DELAY=false`.

### 4C. Groq provider
Create `lib/llm/groq.ts`:
- Uses `GROQ_API_KEY` env var. If missing → fall back to MockLLM, log `provider_fallback`.
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`, model: `llama-3.3-70b-versatile`.
- Uses shared prompt template from `lib/llm/prompt.ts`.
- Parse response as JSON, validate with Zod (same ArtifactResult shape). One retry on parse failure, then fall back to MockLLM.
- API error → fall back to MockLLM, log `provider_fallback`.

### 4D. Prompt template
Create `lib/llm/prompt.ts`:
- System prompt: "You are a US equity compensation assistant. Answer ONLY using the provided context chunks. Never quote or closely paraphrase scrape-tier chunks — extract facts and write in independent wording. Cite curated nodeIds only. If the chunks don't adequately cover the question, say so honestly. Output valid JSON matching this exact schema: {title: string, bodyMarkdown: string, citations: [{nodeId: string, title: string}], quickShare: string}. The bodyMarkdown should be well-structured with headers, bullet points, and clear explanations. The quickShare should be a concise plaintext version."
- User message: includes the query + each chunk formatted with its tier label, nodeId, and text.

### 4E. Anthropic provider (stub)
Create `lib/llm/anthropic.ts`:
- Same interface. For now, falls back to MockLLM with log "Anthropic provider not yet configured."

### 4F. Logging
Create `lib/log.ts`:
- `logArtifact(data)`: appends JSON line to `data/artifact-log.jsonl` (local) or structured `console.log` (Vercel, detected via `process.env.VERCEL`).
- Fields: `ts`, `mode` (mock/groq/anthropic), `query`, `scenarioId`, `matchedNodeIds`, `format`, `deliveredVia`, `emailTo`, `fallbackUsed`.
- Logging failure NEVER throws — catch, return `{ logged: false }`.
- Add `data/artifact-log.jsonl` to `.gitignore`.

### 4G. API routes

**`app/api/artifact/route.ts`** — `POST`:
- `export const runtime = "nodejs";`
- Body: `{ query?: string, scenarioId?: string, nodeId?: string }`.
- If no query and no scenarioId → 400 `{ error: "empty_query" }`.
- If scenarioId → use the scenario's label as the query, pass scenario's nodeIds for boost.
- Run retriever with the query (and nodeId if provided for boost).
- Run LLM provider with query + retrieved chunks.
- Response shape:
  ```json
  {
    "artifactId": "random-uuid",
    "title": "...",
    "bodyMarkdown": "...",
    "quickShare": "...",
    "citations": [{"nodeId": "1.3", "title": "RSUs & RSAs"}],
    "status": "generated",
    "fallbackUsed": false,
    "scenario": {"id": "rsu-vesting-tax", "label": "..."} | null,
    "logged": true
  }
  ```

**`app/api/artifact/pdf/route.ts`** — `POST`:
- `export const runtime = "nodejs";`
- Body: `{ title, bodyMarkdown, citations }`.
- Use `@react-pdf/renderer` to build a 1-page PDF:
  - Header: title in bold + "DRAFT" badge.
  - Body: extract up to 5 key points from bodyMarkdown (truncate each at 280 chars).
  - Footer: disclaimer text + "Qapita · preview build" + current date.
- Return `application/pdf`, `Content-Disposition: inline; filename="equity-brief.pdf"`.

**`app/api/artifact/deliver/route.ts`** — `POST`:
- `export const runtime = "nodejs";`
- Body: `{ artifactId, channel: "email", email }`.
- Validate email format. Invalid → 400.
- Log the request. Return `{ ok: true, logged: true }`.

### Step 4 tests

Write `tests/llm.test.ts`:

```ts
// All tests use MOCK_DELAY=false for speed. Set process.env.MOCK_DELAY = "false" in beforeAll.

// 1. MockLLM produces valid ArtifactResult from chunks
// Given 3 curated chunks with known text:
// - result.title starts with "Reference:"
// - result.bodyMarkdown contains "What this covers" and "Key points"
// - result.bodyMarkdown contains text from the provided chunks (first two sentences)
// - result.citations is an array of {nodeId, title} objects
// - result.citations nodeIds come from the input chunks
// - result.quickShare is a non-empty string
// - result.quickShare does NOT contain markdown formatting (no ##, no **, no -)

// 2. MockLLM excludes scrape-tier text from output
// Given 2 curated chunks + 2 scrape chunks (scrape chunks contain unique sentinel string "SCRAPE_SENTINEL_XYZ"):
// - result.bodyMarkdown does NOT contain "SCRAPE_SENTINEL_XYZ"
// - result.quickShare does NOT contain "SCRAPE_SENTINEL_XYZ"

// 3. MockLLM dedupes citations
// Given 4 chunks, 2 from nodeId "1.3" and 2 from nodeId "3.2":
// - result.citations has exactly 2 entries (not 4)

// 4. MockLLM handles empty chunks gracefully
// Given 0 chunks:
// - Does not throw
// - Returns a valid ArtifactResult (may have empty citations)

// 5. Provider selection
// - LLM_PROVIDER=mock → getLLMProvider() returns MockLLM instance
// - LLM_PROVIDER=groq without GROQ_API_KEY → falls back to mock (no crash)
// - LLM_PROVIDER=anthropic → falls back to mock with log (no crash)
// - LLM_PROVIDER=undefined → defaults to mock

// 6. Groq provider fallback
// - When GROQ_API_KEY is missing, groq provider falls back to mock (returns valid result, no throw)
// - When API call would fail (mock the fetch to reject), falls back to mock (returns valid result)
```

Write `tests/api.test.ts`:

```ts
// Test API routes using the Next.js route handler directly (import the POST function).
// Set MOCK_DELAY=false for speed.

// 1. POST /api/artifact with query
// - POST { query: "How are RSUs taxed?" }
// - Response status 200
// - Response body has: artifactId (string), title (string), bodyMarkdown (string),
//   quickShare (string), citations (array), status ("generated"),
//   fallbackUsed (boolean), logged (boolean)
// - bodyMarkdown is non-empty and contains content about RSUs
// - citations array is non-empty, each has nodeId and title

// 2. POST /api/artifact with scenarioId
// - POST { scenarioId: "rsu-vesting-tax" }
// - Response status 200
// - Response body has scenario field with id and label
// - citations reference nodes from the scenario's nodeIds

// 3. POST /api/artifact with nodeId boost
// - POST { query: "vesting schedule", nodeId: "2.2" }
// - Response status 200
// - citations should include nodeId "2.2" (boosted)

// 4. POST /api/artifact empty body → 400
// - POST {}
// - Response status 400
// - Response body has error: "empty_query"

// 5. POST /api/artifact/deliver valid email
// - POST { artifactId: "test-123", channel: "email", email: "test@example.com" }
// - Response status 200
// - Response body has ok: true, logged: true

// 6. POST /api/artifact/deliver invalid email
// - POST { artifactId: "test-123", channel: "email", email: "not-an-email" }
// - Response status 400

// 7. POST /api/artifact/pdf
// - POST { title: "Test", bodyMarkdown: "## Point 1\nSome content", citations: [] }
// - Response status 200
// - Response content-type is application/pdf
// - Response body is non-empty (PDF bytes)

// 8. Logging works
// - After a successful /api/artifact call, data/artifact-log.jsonl contains a new line
// - The log line is valid JSON with fields: ts, mode, query, fallbackUsed
```

Write `tests/log.test.ts`:

```ts
// 1. logArtifact writes valid JSON line
// - Call logArtifact with test data
// - Read last line of artifact-log.jsonl
// - Parse as JSON — valid
// - Contains: ts (ISO string), mode, query

// 2. logArtifact never throws
// - Mock fs.appendFile to throw
// - logArtifact returns { logged: false } (no exception)

// 3. Vercel mode uses console.log
// - Set process.env.VERCEL = "1"
// - Spy on console.log
// - logArtifact writes to console, not file
// - Cleanup: delete process.env.VERCEL
```

### Step 4 verification

```bash
npm test             # ALL tests pass (scaffold + content + retrieval + scenarios + llm + api + log)
npx tsc --noEmit     # no type errors
```

Also test with curl (start dev server first):
```bash
# Free-text query
curl -s -X POST http://localhost:3000/api/artifact -H "Content-Type: application/json" -d "{\"query\":\"How are RSUs taxed at vesting?\"}" | jq .

# Scenario query
curl -s -X POST http://localhost:3000/api/artifact -H "Content-Type: application/json" -d "{\"scenarioId\":\"rsu-vesting-tax\"}" | jq .

# Empty → 400
curl -s -X POST http://localhost:3000/api/artifact -H "Content-Type: application/json" -d "{}" | jq .

# Deliver
curl -s -X POST http://localhost:3000/api/artifact/deliver -H "Content-Type: application/json" -d "{\"artifactId\":\"test\",\"channel\":\"email\",\"email\":\"test@example.com\"}" | jq .

# PDF (save to file and open)
curl -s -X POST http://localhost:3000/api/artifact/pdf -H "Content-Type: application/json" -d "{\"title\":\"RSU Tax Guide\",\"bodyMarkdown\":\"## Key Points\\n1. RSUs taxed as ordinary income at vesting\",\"citations\":[]}" -o test.pdf
```

Verify each curl response matches the expected shape. Delete test.pdf after.

---

## Step 5: Generate page UI

**What to build:** the `/generate` page with full UX — describe box, scenario chips, loading states, result tabs, fallback, error states, and UI tests.

**Prerequisite:** Step 4 complete (`npm test` passes, API routes work via curl).

### 5A. Page layout
Replace the `/generate` placeholder. Page structure (top to bottom):
1. DraftStrip (already global from Step 1).
2. Optional context chip: if `?nodeId=` in URL, show `Using: <node title> ✕` chip above the textarea. Removing it clears the nodeId param. When present, change placeholder to: "What do you need to explain about {title}?"
3. Textarea: placeholder "Describe the problem — e.g. 'An employee is asking why taxes were withheld at vest'". Fixed 16px font size. If `?q=` in URL, prefill the text.
4. Submit button: accent-solid background, accent-on text: "Generate". Disabled when textarea empty or loading.
5. Scenario chips: all 8 scenario labels as chips below the textarea. Wrap to rows. Tap targets ≥ 44px height. Surface-2 background, border, rounded. On click: submit with that scenario's ID (which uses the label as the query, triggering real retrieval).

### 5B. Loading state
On submit:
1. Disable button and textarea.
2. Show staged inline status text (muted, below button):
   - First: "Searching the knowledge base…" (immediately).
   - After 600ms: change to "Drafting your answer…"
3. Below status: skeleton card with tab bar placeholder (3 gray tabs) + 4 shimmer lines (animated pulse, surface-2 on surface-1).
4. No modal, no spinner, no overlay.

### 5C. ArtifactResult component
Receives the API response. Card with surface-1 background, border, 12px radius.

**Tab bar:** 3 tabs — "Text", "PDF", "Quick-share". Active tab has accent underline.

**Text tab (default):**
- Rendered markdown (bodyMarkdown). Use a simple markdown renderer.
- "Based on" row below: chips for each citation, linking to `/a/{pillarSlug}/{slug}` (will show "Coming soon" until Phase 2 — that's fine).

**PDF tab:**
- "Open PDF" button (accent-solid).
- On click: POST to `/api/artifact/pdf`, show "Preparing PDF…" while loading.
- Open returned PDF in new tab.

**Quick-share tab:**
- Plaintext (quickShare field) in a styled block.
- "Copy text" button → clipboard. Success: "Copied ✓" for 2s, `aria-live="polite"`. Failure: auto-select text + "Press and hold to copy."

**Email action:**
- Below tabs: "Email this" button.
- Opens inline section: email input (16px font) + "Log email request" button.
- On submit: POST to `/api/artifact/deliver`.
- Success: "Request logged — no email sent. Email delivery isn't enabled in this preview build. We've recorded that you wanted this sent to {email}."

### 5D. Fallback state
When `fallbackUsed: true`:
- Render the result normally.
- Above result, show notice: "We couldn't confidently answer that from our library, so here's the closest curated scenario: **{scenario label}**."
- Keep query visible. Show "Try rephrasing" link (clears result, focuses textarea).

### 5E. Error state
On API error (5xx/network):
- Inline error card (surface-2, 12px radius):
  - Heading (Instrument Serif): "Something went wrong"
  - Body: "We couldn't generate that — your question wasn't lost. Try again."
  - "Try again" button (resubmits same query).
- Do NOT clear textarea.
- Offline (navigator.onLine === false): "You appear to be offline. Generating an answer needs a connection — browsing and search still work."

### 5F. Empty submit
If textarea empty: show inline hint "Please describe what you need help with." No request sent.

### Step 5 tests

Write `tests/generate-page.test.ts`:

```ts
// Component-level tests for the Generate page and ArtifactResult.
// Use Vitest with jsdom environment if testing React components,
// or test the logic functions extracted from the components.

// 1. Scenario chips render all 8 scenarios
// - All 8 scenario labels are present in the chip list
// - Each chip has a click handler

// 2. Textarea respects placeholder text
// - Default placeholder matches exact microcopy from CLAUDE.md
// - When nodeId is set, placeholder changes to "What do you need to explain about {title}?"

// 3. Submit button disabled states
// - Disabled when textarea is empty
// - Disabled when loading is true
// - Enabled when textarea has text and not loading

// 4. Query params
// - ?q=test prefills textarea with "test"
// - ?nodeId=1.1 shows "Using: Incentive stock options (ISOs)" chip

// 5. ArtifactResult renders all tabs
// Given a mock ArtifactResult:
// - Text tab renders bodyMarkdown content
// - Text tab shows "Based on" citations
// - Quick-share tab shows plaintext
// - PDF tab shows "Open PDF" button
// - Tab switching works (only active tab content visible)

// 6. Copy button states
// - Initial state: "Copy text"
// - After successful copy: "Copied ✓"
// - Reverts after 2 seconds

// 7. Email flow
// - "Email this" reveals email input
// - Submitting valid email shows success message containing "no email sent"
// - Success message contains the submitted email address

// 8. Fallback state renders notice
// Given response with fallbackUsed: true and scenario:
// - Notice card is visible
// - Contains "We couldn't confidently answer that"
// - Contains scenario label
// - "Try rephrasing" link is visible

// 9. Error state renders correctly
// - Error card shows "Something went wrong" heading
// - "Try again" button is present
// - Textarea is NOT cleared

// 10. Empty submit shows hint
// - Submitting with empty textarea shows "Please describe what you need help with."
// - No API request is made (mock fetch, verify it was not called)
```

Write `tests/e2e.test.ts` — **end-to-end integration test** (runs against real dev server):

```ts
// This test starts the dev server, makes real HTTP requests, and validates responses.
// Use Vitest with a longer timeout (120s). Requires npm run build:index to have been run.

// 1. Full RAG pipeline: query → retrieval → generation → valid response
// - POST /api/artifact { query: "How are RSUs taxed at vesting?" }
// - Status 200
// - bodyMarkdown mentions RSU or restricted stock (content is relevant)
// - citations include at least one of nodes 1.3, 3.2
// - fallbackUsed === false
// - quickShare is non-empty plaintext

// 2. Scenario pipeline: scenarioId → retrieval → generation → valid response
// - POST /api/artifact { scenarioId: "iso-exercise-amt" }
// - Status 200
// - bodyMarkdown mentions ISO or incentive stock option
// - citations include at least one of nodes 1.1, 3.1, 3.3

// 3. Fallback pipeline: obscure query → fallback
// - POST /api/artifact { query: "Belgian chocolate stock option taxation in 2024" }
// - Status 200
// - fallbackUsed === true
// - fallbackScenario or scenario field is populated

// 4. nodeId boost: boosted node appears in citations
// - POST /api/artifact { query: "vesting schedule", nodeId: "2.2" }
// - Status 200
// - citations include nodeId "2.2"

// 5. PDF generation produces valid PDF
// - POST /api/artifact/pdf with test data
// - Response content-type contains "pdf"
// - Response body starts with %PDF (PDF magic bytes)

// 6. Deliver endpoint logs correctly
// - POST /api/artifact/deliver { artifactId: "e2e-test", channel: "email", email: "e2e@test.com" }
// - Status 200, ok: true

// 7. No scrape text leaks in mock mode
// - Generate several artifacts with different queries
// - None of the bodyMarkdown responses contain scrape-tier sentinel text
// (This validates the mock never renders scrape chunk text)
```

### Step 5 verification

```bash
npm test             # ALL tests pass (every test file from all 5 steps)
npx tsc --noEmit     # no type errors
npm run build        # full build succeeds (build:index + next build)
```

Open browser and test every flow manually:
1. `http://localhost:3000` — home page, click "Ask a question →"
2. Click any scenario chip → see loading states → artifact appears with real content
3. Verify Text tab shows markdown with "Based on" citations
4. Click "PDF" tab → "Open PDF" → PDF opens in new tab with content
5. Click "Quick-share" tab → "Copy text" → "Copied ✓" appears
6. Click "Email this" → enter email → "Log email request" → see "no email sent" message
7. Type a real question "What is an 83(b) election?" → submit → relevant artifact
8. Type "Belgian chocolate recipe" → fallback notice appears
9. Submit with empty textarea → hint appears, no loading
10. DraftStrip visible at top, footer disclaimer at bottom
11. All 8 scenario chips visible, wrapping correctly on mobile width

---

## Directory structure (Phase 1, final)
```
app/
  layout.tsx globals.css page.tsx
  generate/page.tsx
  browse/page.tsx                       # placeholder
  p/[pillar]/page.tsx                   # placeholder
  a/[pillar]/[slug]/page.tsx            # placeholder
  start-here/page.tsx                   # placeholder
  glossary/page.tsx                     # placeholder
  glossary/[term]/page.tsx              # placeholder
  search/page.tsx                       # placeholder
  legal/disclaimer/page.tsx
  api/artifact/route.ts
  api/artifact/pdf/route.ts
  api/artifact/deliver/route.ts
components/
  AppShell.tsx DraftStrip.tsx ArtifactResult.tsx ScenarioChips.tsx
content/
  pillars/                              # 12 flagship MDX files
    awards/ lifecycle/ tax/ accounting/
    securities-law/ plan-design/ admin-ops/
data/
  vectors.bin                           # built by build:index (gitignored)
  chunks.json                           # built by build:index (gitignored)
  artifact-log.jsonl                    # runtime log (gitignored)
lib/
  content/schema.ts loader.ts tree.ts
  embeddings/provider.ts
  retrieval/retriever.ts constants.ts
  llm/provider.ts mock.ts groq.ts anthropic.ts prompt.ts
  scenarios.ts
  pdf/template.tsx
  log.ts
scripts/
  ingest/build-indexes.ts
tests/
  scaffold.test.ts
  content.test.ts
  retrieval.test.ts
  retrieval-integration.test.ts
  scenarios.test.ts
  llm.test.ts
  api.test.ts
  log.test.ts
  generate-page.test.ts
  e2e.test.ts
```

---

## Acceptance criteria (Phase 1)
1. `npm i && npm run dev` works with zero API keys.
2. `npm run build:index` generates vectors.bin + chunks.json from 12 committed MDX files + 8 scenario embeddings.
3. `npm test` passes — all test files green, zero failures.
4. `npx tsc --noEmit` passes — zero type errors.
5. `npm run build` succeeds (build:index + next build).
6. Home page: dark theme, correct fonts, link to /generate.
7. `/generate`: scenario chip → real retrieval → real artifact generated from chunks → all 3 tabs.
8. `/generate`: free-text → real retrieval → artifact assembled from actual content.
9. `/generate`: obscure query → fallback notice with nearest scenario.
10. PDF opens inline in new tab with content from the response.
11. Quick-share copy works.
12. Email "no email sent" copy works.
13. Error/offline states render correctly.
14. DraftStrip + footer disclaimer visible on all pages.
15. `<meta name="robots" content="noindex">` present.
16. No NASPP marks anywhere.
17. All 12 MDX files parse with Zod.
18. When `GROQ_API_KEY` is set and `LLM_PROVIDER=groq`, responses come from Groq instead of mock — same UI, richer output.

---

## What comes later (Phase 2 — nothing breaks)
Adding any of these requires zero changes to the chatbot:
- **29 stub articles** → write MDX files, rerun `npm run build:index` → retriever has more content
- **Browse/pillar/article pages** → build the route components, content already exists
- **Glossary, Start-Here, Search** → new routes + content files
- **Lens toggle (Pro/Plain)** → LensProvider + Advanced MDX component
- **Anthropic provider** → implement the stub
- **Ingest pipeline for scrape data** → adds scrape-tier chunks to the index
