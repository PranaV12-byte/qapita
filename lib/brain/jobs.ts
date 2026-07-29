import { randomUUID } from "node:crypto";
import path from "node:path";
import { chunkMarkdown, type ChunkResult, type SectionResult } from "../rag/chunker";
import { getEmbedder, EmbedCache, embedInBlocks } from "../rag/embedder";
import { buildEmbedInput } from "../rag/contextualize";
import { extractDocument, type ExtractFailure } from "./extract";
import { runHealthCheck, type HealthCheckResult } from "./healthCheck";
import { planPlacement, type PlacementPlan } from "./placement";
import { weaveSource, getExistingSourceProbes, type WeaveReport } from "./weave";

// ── Shared brain embed cache (V0 / SPEC-VAULT §3) ───────────────────────────────
// User uploads embed through the same content-hash cache the offline corpus
// build uses, so re-uploading identical content (or overlapping sections) is a
// cache hit — zero embedder calls. Process-wide singleton; flushed after each
// weave. Keyed by the exact embed-input string, so any chunk/heading change is
// a targeted miss.
const BRAIN_EMBED_CACHE_FILE = path.join(process.cwd(), "data", ".brain-embed-cache.json");
let _brainEmbedCache: EmbedCache | null = null;
function brainEmbedCache(): EmbedCache {
  if (!_brainEmbedCache) {
    _brainEmbedCache = new EmbedCache(BRAIN_EMBED_CACHE_FILE);
    _brainEmbedCache.load();
  }
  return _brainEmbedCache;
}

/** Section vector = normalized mean of that section's chunk vectors — enough to
 *  bucket the section against node targets for placement without a second
 *  embedding pass (retrieval itself always uses the real per-chunk vectors). */
function sectionVectorsFromChunks(
  chunks: ChunkResult[],
  chunkVecs: Float32Array[],
  sections: SectionResult[],
  dim: number
): Float32Array[] {
  const byParent = new Map<string, number[]>();
  chunks.forEach((c, i) => {
    const arr = byParent.get(c.parentId);
    if (arr) arr.push(i);
    else byParent.set(c.parentId, [i]);
  });
  return sections.map((s) => {
    const mean = new Float32Array(dim);
    for (const i of byParent.get(s.parentId) ?? []) {
      const v = chunkVecs[i];
      for (let d = 0; d < dim; d++) mean[d] += v[d];
    }
    let norm = 0;
    for (let d = 0; d < dim; d++) norm += mean[d] * mean[d];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let d = 0; d < dim; d++) mean[d] /= norm;
    return mean;
  });
}

// ── In-memory ingest job registry (SPEC-BRAIN.md Phase 3) ───────────────────────
// Deliberately in-memory, not persisted: a server restart loses only
// in-flight jobs (the client sees a clean "please re-upload"), never
// already-woven content — that's durable the moment weaveSource() returns.

export type JobStage = "extracting" | "vetting" | "weaving" | "done" | "needs-review" | "blocked";

type PendingReview = {
  fileName: string;
  format: string;
  buffer: Buffer;
  title: string;
  markdown: string;
  health: HealthCheckResult;
};

export type JobRecord = {
  jobId: string;
  brainId: string;
  fileName: string;
  stage: JobStage;
  progress: { current: number; total: number } | null;
  createdAt: string;
  updatedAt: string;
  weaveReport?: WeaveReport;
  health?: HealthCheckResult;
  extractFailure?: ExtractFailure;
  error?: string;
  /** Internal only — never serialized to the client (holds raw file bytes). */
  pending?: PendingReview;
};

/** The client-safe view of a job — strips `pending` (which carries a raw
 *  Buffer and isn't meaningful JSON) while still surfacing health/reasons so
 *  the UI can render "needs review" cards. */
export type JobView = Omit<JobRecord, "pending"> & {
  awaitingConfirmation: boolean;
};

const jobs = new Map<string, JobRecord>();

function touch(job: JobRecord): void {
  job.updatedAt = new Date().toISOString();
}

function updateJob(jobId: string, patch: Partial<JobRecord>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch);
  touch(job);
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function serializeJob(job: JobRecord): JobView {
  const { pending, ...rest } = job;
  return { ...rest, awaitingConfirmation: job.stage === "needs-review" && !!pending };
}

async function finishWeave(
  jobId: string,
  brainId: string,
  fileName: string,
  format: string,
  title: string,
  markdown: string,
  contentHash: string,
  probeVector: Float32Array,
  buffer: Buffer,
  chosenNodeId?: string
): Promise<void> {
  const sourceId = randomUUID();
  const embedder = getEmbedder();

  // ── Single pass (V0): chunk once (docId === sourceId so parentIds match the
  // weave append), build each chunk's embed-input once, embed once through the
  // shared cache with real progress, then reuse those vectors for BOTH
  // placement scoring and the weave — no second chunk/embed anywhere. ──
  const { chunks, sections, title: chunkedTitle } = chunkMarkdown(markdown, {
    docId: sourceId,
    title,
  });
  const total = Math.max(chunks.length, 1);
  updateJob(jobId, { stage: "weaving", progress: { current: 0, total } });

  const embedInputs: string[] = [];
  for (const c of chunks) {
    embedInputs.push(await buildEmbedInput(chunkedTitle, c.headingPath, c.text));
  }
  const cache = brainEmbedCache();
  const chunkVecs = await embedInBlocks(cache, embedder, embedInputs, 16, (current) => {
    updateJob(jobId, { progress: { current, total } });
  });
  cache.flush();

  const dim = chunkVecs[0]?.length ?? embedder.dim;
  const sectionVecs = sectionVectorsFromChunks(chunks, chunkVecs, sections, dim);

  let plan: PlacementPlan;
  if (chosenNodeId) {
    // User override — every section of the document goes to the chosen
    // topic, bypassing the heuristic classifier entirely.
    plan = { sectionNodeIds: sections.map(() => chosenNodeId), newNodes: [] };
  } else {
    plan = await planPlacement(title, markdown, {
      embedder,
      precomputed: { sections, sectionVecs, probeVector },
    });
  }

  const report = await weaveSource({
    brainId,
    sourceId,
    fileName,
    format,
    originalBuffer: buffer,
    title,
    markdown,
    plan,
    contentHash,
    probeVector,
    precomputed: { chunks, sections, chunkedTitle, chunkVecs },
  });

  updateJob(jobId, {
    stage: "done",
    progress: { current: report.totalPassages, total: report.totalPassages },
    weaveReport: report,
  });
}

async function runIngestPipeline(
  jobId: string,
  brainId: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  updateJob(jobId, { stage: "extracting" });
  const extracted = await extractDocument(fileName, buffer);
  if (!extracted.ok) {
    updateJob(jobId, { stage: "blocked", extractFailure: extracted });
    return;
  }

  updateJob(jobId, { stage: "vetting" });
  const existingSources = getExistingSourceProbes(brainId);
  const health = await runHealthCheck(extracted.title, extracted.markdown, { existingSources });

  if (health.status === "fail") {
    updateJob(jobId, { stage: "blocked", health });
    return;
  }

  if (health.status === "warn") {
    const job = jobs.get(jobId);
    if (!job) return;
    job.pending = {
      fileName,
      format: extracted.meta.format,
      buffer,
      title: extracted.title,
      markdown: extracted.markdown,
      health,
    };
    updateJob(jobId, { stage: "needs-review", health });
    return;
  }

  // status === "pass" -> weave automatically, no confirmation needed.
  await finishWeave(
    jobId,
    brainId,
    fileName,
    extracted.meta.format,
    extracted.title,
    extracted.markdown,
    health.contentHash,
    health.probeVector,
    buffer
  );
}

/** Spawns a job and returns its id immediately (fire-and-forget) — the route
 *  responds without waiting for extraction/embedding, and the client polls
 *  getJob()/serializeJob() for progress. */
export function startIngestJob(brainId: string, fileName: string, buffer: Buffer): string {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  jobs.set(jobId, {
    jobId,
    brainId,
    fileName,
    stage: "extracting",
    progress: null,
    createdAt: now,
    updatedAt: now,
  });

  runIngestPipeline(jobId, brainId, fileName, buffer).catch((err) => {
    updateJob(jobId, {
      stage: "blocked",
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return jobId;
}

/** Resolves a "needs-review" job: `action: "add"` weaves it in (optionally
 *  forcing every section to `chosenNodeId`); `"discard"` blocks it with no
 *  side effects. Throws if the job isn't actually awaiting confirmation. */
export async function confirmJob(
  jobId: string,
  action: "add" | "discard",
  chosenNodeId?: string
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.stage !== "needs-review" || !job.pending) {
    throw new Error("Job is not awaiting confirmation.");
  }
  const pending = job.pending;

  if (action === "discard") {
    updateJob(jobId, { stage: "blocked", error: "Discarded by user.", pending: undefined });
    return;
  }

  await finishWeave(
    jobId,
    job.brainId,
    pending.fileName,
    pending.format,
    pending.title,
    pending.markdown,
    pending.health.contentHash,
    pending.health.probeVector,
    pending.buffer,
    chosenNodeId
  );
}
