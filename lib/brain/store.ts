import fs from "node:fs";
import path from "node:path";
import { BRAIN_LRU, BRAIN_MAX_PASSAGES } from "../rag/config";
import { isValidBrainId } from "./id";

// ── The ONLY module that touches data/brains/** (SPEC-BRAIN.md Sec3.2, Phase 1) ──
// Owns brain identity validation, directory layout, manifest read/write, atomic
// writes, per-brain serialization, and a generic loaded-state cache. Deliberately
// has NO retrieval logic — later phases (weave, retrieval, lint) build on this.

const DEFAULT_BRAINS_DIR = process.env.NETLIFY
  ? path.join(process.env.TMPDIR ?? "/tmp", "equityiq-brains")
  : path.join(process.cwd(), "data", "brains");

export { isValidBrainId };

export type BrainSourceMeta = {
  sourceId: string;
  fileName: string;
  format: string;
  addedAt: string;
  nodeIds: string[];
  passageCount: number;
  /** For duplicate detection on future uploads (lib/brain/healthCheck.ts). */
  contentHash: string;
  /** Float32Array serialized as a plain array (JSON has no typed-array form). */
  probeVector: number[];
};

export type BrainManifest = {
  brainId: string;
  createdAt: string;
  sources: Record<string, BrainSourceMeta>;
  counts: { sources: number; passages: number };
  caps: { maxPassages: number };
  lint: { lastLintAt: string | null; appendsSinceLint: number };
};

export type BrainPaths = {
  dir: string;
  sourcesDir: string;
  manifestPath: string;
  journalPath: string;
  answersPath: string;
};

/** One logged answer — powers node backlinks ("cited by N answers") and a
 *  recent-questions list, without persisting full chat threads. */
export type BrainAnswer = {
  artifactId: string;
  query: string;
  title: string;
  citations: { kind?: string; nodeId?: string; sourceId?: string; title: string }[];
  ts: string;
};

/** Writes never leave a partially-written destination file: always write to a
 *  sibling temp file first, then rename — atomic on the same volume (NTFS and
 *  POSIX filesystems alike), so a crash between the two steps leaves either
 *  the old file (rename never happened) or the fully-written new one. */
export function atomicWriteFileSync(filePath: string, data: string | Buffer): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  );
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

/** Small Map-based LRU (insertion-order = recency; re-inserting on access bumps
 *  it). Generic — Phase 4's retrieval layer decides what it actually caches. */
export class BoundedCache<T> {
  private readonly map = new Map<string, T>();
  constructor(private readonly max: number) {}

  get(key: string): T | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as T;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  invalidate(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export type BrainStore = {
  brainPaths(brainId: string): BrainPaths;
  /** Cheap existence check, no side effects — the empty-brain fast path. */
  brainExists(brainId: string): boolean;
  loadManifest(brainId: string): BrainManifest | null;
  saveManifest(brainId: string, manifest: BrainManifest): void;
  appendJournal(brainId: string, line: string): void;
  /** Append one answer to the brain's answers.jsonl (JSONL, like lib/log.ts). */
  appendAnswer(brainId: string, answer: BrainAnswer): void;
  /** Creates a brand-new brain: dir + sources/ + manifest.json + a journal line.
   *  Only call this when about to add real content — never on a bare page load. */
  createBrain(brainId: string): BrainManifest;
  eraseBrain(brainId: string): void;
  /** Runs `fn` after any prior operation queued for this brainId has settled
   *  (success or failure), so weaves/removes on the same brain never race. */
  withLock<T>(brainId: string, fn: () => Promise<T>): Promise<T>;
  /** Generic cache for whatever a later phase decides to keep warm per brain
   *  (e.g. loaded retrieval stores) — bounded to BRAIN_LRU entries. */
  cache: BoundedCache<unknown>;
};

export function createBrainStore(rootDir: string = DEFAULT_BRAINS_DIR): BrainStore {
  const locks = new Map<string, Promise<unknown>>();
  const cache = new BoundedCache<unknown>(BRAIN_LRU);

  function requireValidId(brainId: string): void {
    if (!isValidBrainId(brainId)) {
      throw new Error(`Invalid brainId: ${JSON.stringify(brainId)}`);
    }
  }

  function brainPaths(brainId: string): BrainPaths {
    requireValidId(brainId);
    const dir = path.join(rootDir, brainId);
    return {
      dir,
      sourcesDir: path.join(dir, "sources"),
      manifestPath: path.join(dir, "manifest.json"),
      journalPath: path.join(dir, "journal.md"),
      answersPath: path.join(dir, "answers.jsonl"),
    };
  }

  function brainExists(brainId: string): boolean {
    return fs.existsSync(brainPaths(brainId).manifestPath);
  }

  function loadManifest(brainId: string): BrainManifest | null {
    const { manifestPath } = brainPaths(brainId);
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as BrainManifest;
  }

  function saveManifest(brainId: string, manifest: BrainManifest): void {
    const { manifestPath } = brainPaths(brainId);
    atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    cache.invalidate(brainId);
  }

  function appendJournal(brainId: string, line: string): void {
    const { journalPath, dir } = brainPaths(brainId);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(journalPath, line.endsWith("\n") ? line : line + "\n");
  }

  function appendAnswer(brainId: string, answer: BrainAnswer): void {
    const { answersPath, dir } = brainPaths(brainId);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(answersPath, JSON.stringify(answer) + "\n");
  }

  function createBrain(brainId: string): BrainManifest {
    const { sourcesDir } = brainPaths(brainId);
    fs.mkdirSync(sourcesDir, { recursive: true });
    const manifest: BrainManifest = {
      brainId,
      createdAt: new Date().toISOString(),
      sources: {},
      counts: { sources: 0, passages: 0 },
      caps: { maxPassages: BRAIN_MAX_PASSAGES },
      lint: { lastLintAt: null, appendsSinceLint: 0 },
    };
    saveManifest(brainId, manifest);
    appendJournal(brainId, `## [${manifest.createdAt}] created | new anonymous brain`);
    return manifest;
  }

  function eraseBrain(brainId: string): void {
    const { dir } = brainPaths(brainId);
    fs.rmSync(dir, { recursive: true, force: true });
    cache.invalidate(brainId);
  }

  function withLock<T>(brainId: string, fn: () => Promise<T>): Promise<T> {
    requireValidId(brainId);
    const prior = locks.get(brainId) ?? Promise.resolve();
    const result = prior.then(fn, fn);
    locks.set(brainId, result.catch(() => undefined));
    return result;
  }

  return {
    brainPaths,
    brainExists,
    loadManifest,
    saveManifest,
    appendJournal,
    appendAnswer,
    createBrain,
    eraseBrain,
    withLock,
    cache,
  };
}

/** Process-wide default store, pointed at the real data/brains directory. */
export const brainStore = createBrainStore();
