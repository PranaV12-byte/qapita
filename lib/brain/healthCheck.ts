import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chunkMarkdown } from "../rag/chunker";
import { cosineSimilarity } from "../rag/cosine";
import { extractTitleAndLead } from "../rag/textProbe";
import { getEmbedder } from "../rag/embedder";
import { atomicWriteFileSync } from "./store";
import { loadAllArticles } from "../content/loader";
import { ALL_NODES } from "../content/tree";
import type { Embedder } from "../rag/types";
import {
  BRAIN_MAX_TEXT_MB,
  CLASSIFY_MIN_CONFIDENCE,
  CLASSIFY_NODE_CONFIDENCE,
  DEDUP_COSINE_THRESHOLD,
  GENERAL_NODE_ID,
  GENERAL_NODE_TITLE,
} from "../rag/config";

// ── The health check (SPEC-BRAIN.md Phase 2) ────────────────────────────────────
// Pure given its inputs (no brain writes — the ONE piece of process-wide state
// is the node-target embedding cache, which is a corpus-level artifact, not a
// per-brain one; see loadOrComputeNodeTargets). Checks run in order: readable
// -> caps -> on-topic -> duplicate -> non-English signal.

export type HealthStatus = "pass" | "warn" | "fail";

export type HealthReasonCode =
  | "too_short"
  | "text_too_large"
  | "off_topic"
  | "exact_duplicate"
  | "near_duplicate"
  | "non_english";

export type HealthReason = { code: HealthReasonCode; message: string };

export type ExistingSourceProbe = {
  sourceId: string;
  contentHash: string;
  probeVector: Float32Array;
};

export type HealthCheckOpts = {
  /** Injectable for tests (fake, deterministic embedder). Defaults to the real one. */
  embedder?: Embedder;
  /** Where the node-target cache lives. Defaults to the real data/ dir — tests
   *  MUST override this to a temp dir so a fake embedder's vectors never land
   *  in the real cache the running app relies on. */
  dataDir?: string;
  /** Other sources already in this brain, for duplicate detection. */
  existingSources?: ExistingSourceProbe[];
};

export type HealthCheckResult = {
  status: HealthStatus;
  reasons: HealthReason[];
  suggestedNodeId?: string;
  confidence?: number;
  secondBest?: { nodeId: string; confidence: number };
  isDuplicateOf?: string;
  preview: string;
  chunkEstimate: number;
  /** This source's own probe — Phase 3 persists it so the NEXT upload's
   *  near-duplicate check can compare against this one without re-embedding. */
  contentHash: string;
  probeVector: Float32Array;
};

const MIN_HEALTHCHECK_CHARS = 20;
/** Below this cosine, non-ASCII isn't a strong enough signal to bother judging. */
const MIN_LETTERS_FOR_LANGUAGE_SIGNAL = 20;
// Calibrated against a real, deliberately-French fixture, which measured
// ~4.1% non-ASCII letters (tests/fixtures/brain/pathological/non-english.md)
// — 3% clears that with margin while staying well above the noise from an
// occasional English loanword (a single "café" in 500 words is ~0.05%).
const NON_ASCII_RATIO_THRESHOLD = 0.03;

/** sha256 of the exact extracted text — the "is this literally the same
 *  content again" check, before any embedding-based near-dup comparison. */
export function hashContent(markdown: string): string {
  return crypto.createHash("sha256").update(markdown.trim()).digest("hex");
}

function buildProbe(title: string, markdown: string): string {
  const { title: h1Title, lead } = extractTitleAndLead(markdown);
  const effectiveTitle = h1Title || title;
  return [effectiveTitle, lead].filter(Boolean).join(". ") || markdown.slice(0, 200);
}

/** Simple, honest, dependency-free signal: what fraction of letters fall
 *  outside ASCII. Diacritics/Cyrillic/CJK/etc push this up; the occasional
 *  loanword in English text does not. Not a real language detector — just
 *  enough to justify the "model is English-centric" warning. */
function looksNonEnglish(text: string): boolean {
  const sample = text.slice(0, 2000);
  const letters = sample.match(/\p{L}/gu) ?? [];
  if (letters.length < MIN_LETTERS_FOR_LANGUAGE_SIGNAL) return false;
  const nonAscii = letters.filter((ch) => ch.charCodeAt(0) > 127).length;
  return nonAscii / letters.length > NON_ASCII_RATIO_THRESHOLD;
}

// ── Node-target vectors: computed once, cached to data/node-targets.bin (+json) ──
// Exported so lib/brain/placement.ts reuses the exact same cached vectors
// instead of duplicating this cache (placement classifies per-section against
// the same 41 targets health check classifies the whole document against).

export type NodeTarget = { id: string; title: string };
export type NodeTargetsBundle = { targets: NodeTarget[]; vectors: Float32Array[] };

let _cached: { embedderId: string; dataDir: string; bundle: NodeTargetsBundle } | null = null;

/** Test-only escape hatch (mirrors retriever.ts's clearCache()) — without
 *  this, two test files using differently-behaved fake embedders that happen
 *  to share an id could silently reuse each other's cached vectors. */
export function clearNodeTargetsCache(): void {
  _cached = null;
}

async function computeNodeTargets(embedder: Embedder): Promise<NodeTargetsBundle> {
  const articles = await loadAllArticles();
  const summaryById = new Map(articles.map((a) => [a.frontmatter.id, a.frontmatter.summaryPlain]));
  const targets: NodeTarget[] = ALL_NODES.map((n) => ({ id: n.id, title: n.title }));
  const texts = ALL_NODES.map((n) =>
    summaryById.has(n.id) ? `${n.title}. ${summaryById.get(n.id)}` : n.title
  );
  const vectors = await embedder.embedPassages(texts);
  return { targets, vectors };
}

async function loadOrComputeNodeTargets(
  embedder: Embedder,
  dataDir: string
): Promise<NodeTargetsBundle> {
  const binPath = path.join(dataDir, "node-targets.bin");
  const metaPath = path.join(dataDir, "node-targets.json");
  const currentIds = ALL_NODES.map((n) => n.id);

  if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
        embedderId: string;
        dim: number;
        nodeIds: string[];
      };
      const idsMatch =
        meta.nodeIds.length === currentIds.length &&
        meta.nodeIds.every((id, i) => id === currentIds[i]);
      if (meta.embedderId === embedder.id && idsMatch && meta.dim > 0) {
        const buf = fs.readFileSync(binPath);
        const flat = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        const vectors: Float32Array[] = currentIds.map((_, i) =>
          flat.subarray(i * meta.dim, (i + 1) * meta.dim)
        );
        return { targets: ALL_NODES.map((n) => ({ id: n.id, title: n.title })), vectors };
      }
    } catch {
      // Corrupt or stale cache — fall through and recompute.
    }
  }

  const bundle = await computeNodeTargets(embedder);
  const dim = bundle.vectors[0]?.length ?? embedder.dim;
  const flat = new Float32Array(bundle.targets.length * dim);
  bundle.vectors.forEach((v, i) => flat.set(v, i * dim));
  atomicWriteFileSync(binPath, Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength));
  atomicWriteFileSync(
    metaPath,
    JSON.stringify({ embedderId: embedder.id, dim, nodeIds: currentIds }, null, 2)
  );
  return bundle;
}

export async function getNodeTargets(embedder: Embedder, dataDir: string): Promise<NodeTargetsBundle> {
  if (_cached && _cached.embedderId === embedder.id && _cached.dataDir === dataDir) {
    return _cached.bundle;
  }
  const bundle = await loadOrComputeNodeTargets(embedder, dataDir);
  _cached = { embedderId: embedder.id, dataDir, bundle };
  return bundle;
}

// ── Main entry point ──────────────────────────────────────────────────────────────

export async function runHealthCheck(
  title: string,
  markdown: string,
  opts: HealthCheckOpts = {}
): Promise<HealthCheckResult> {
  const embedder = opts.embedder ?? getEmbedder();
  const dataDir = opts.dataDir ?? path.join(process.cwd(), "data");
  const existingSources = opts.existingSources ?? [];

  const reasons: HealthReason[] = [];
  const trimmed = markdown.trim();
  const preview = trimmed.replace(/\s+/g, " ").slice(0, 240);
  const chunkEstimate = chunkMarkdown(markdown, { title }).chunks.length;
  const contentHash = hashContent(markdown);

  // ── readable ──
  if (trimmed.length < MIN_HEALTHCHECK_CHARS) {
    return {
      status: "fail",
      reasons: [
        {
          code: "too_short",
          message: `Only ${trimmed.length} characters of extracted content — too little to evaluate.`,
        },
      ],
      preview,
      chunkEstimate,
      contentHash,
      probeVector: new Float32Array(embedder.dim),
    };
  }

  // ── caps ── (BRAIN_MAX_FILE_MB is enforced in extract.ts pre-parse; this is
  // the post-extraction cap — a small compressed file can still yield a huge
  // amount of extracted text, e.g. a densely-nested spreadsheet or PDF).
  const textMb = Buffer.byteLength(markdown, "utf-8") / (1024 * 1024);
  if (textMb > BRAIN_MAX_TEXT_MB) {
    return {
      status: "fail",
      reasons: [
        {
          code: "text_too_large",
          message: `Extracted text is ${textMb.toFixed(1)}MB, over the ${BRAIN_MAX_TEXT_MB}MB limit.`,
        },
      ],
      preview,
      chunkEstimate,
      contentHash,
      probeVector: new Float32Array(embedder.dim),
    };
  }

  // ── on-topic ──
  const probe = buildProbe(title, markdown);
  const probeVector = await embedder.embedPassage(probe);
  const { targets, vectors } = await getNodeTargets(embedder, dataDir);

  let best = { i: -1, cos: -Infinity };
  let second = { i: -1, cos: -Infinity };
  vectors.forEach((tv, i) => {
    const cos = cosineSimilarity(probeVector, tv);
    if (cos > best.cos) {
      second = best;
      best = { i, cos };
    } else if (cos > second.cos) {
      second = { i, cos };
    }
  });

  let suggestedNodeId: string | undefined;
  const confidence = best.i >= 0 ? best.cos : undefined;
  const secondBest =
    second.i >= 0 ? { nodeId: targets[second.i].id, confidence: second.cos } : undefined;

  if (best.i < 0 || best.cos < CLASSIFY_MIN_CONFIDENCE) {
    reasons.push({
      code: "off_topic",
      message:
        "This doesn't look related to equity compensation — it may not be useful in your wiki.",
    });
  } else if (best.cos >= CLASSIFY_NODE_CONFIDENCE) {
    suggestedNodeId = targets[best.i].id;
  } else {
    suggestedNodeId = GENERAL_NODE_ID;
  }
  const suggestedNodeTitle =
    suggestedNodeId && suggestedNodeId !== GENERAL_NODE_ID
      ? targets.find((t) => t.id === suggestedNodeId)?.title
      : suggestedNodeId === GENERAL_NODE_ID
        ? GENERAL_NODE_TITLE
        : undefined;
  void suggestedNodeTitle; // surfaced via suggestedNodeId; tree.getNode() resolves the title downstream.

  // ── duplicate ──
  let isDuplicateOf: string | undefined;
  const exactMatch = existingSources.find((s) => s.contentHash === contentHash);
  if (exactMatch) {
    isDuplicateOf = exactMatch.sourceId;
    reasons.push({
      code: "exact_duplicate",
      message: "This is identical to a source you've already added.",
    });
  } else {
    let bestDup: { sourceId: string; cos: number } | null = null;
    for (const s of existingSources) {
      const cos = cosineSimilarity(probeVector, s.probeVector);
      if (cos >= DEDUP_COSINE_THRESHOLD && (!bestDup || cos > bestDup.cos)) {
        bestDup = { sourceId: s.sourceId, cos };
      }
    }
    if (bestDup) {
      isDuplicateOf = bestDup.sourceId;
      reasons.push({
        code: "near_duplicate",
        message: "This looks very similar to a source you've already added.",
      });
    }
  }

  // ── non-English signal ──
  if (looksNonEnglish(markdown)) {
    reasons.push({
      code: "non_english",
      message:
        "This looks like it's not in English. The local embedding model is English-centric, so retrieval quality may be weaker for this source.",
    });
  }

  const status: HealthStatus = reasons.length > 0 ? "warn" : "pass";

  return {
    status,
    reasons,
    suggestedNodeId,
    confidence,
    secondBest,
    isDuplicateOf,
    preview,
    chunkEstimate,
    contentHash,
    probeVector,
  };
}
