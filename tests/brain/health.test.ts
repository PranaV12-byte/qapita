import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  runHealthCheck,
  hashContent,
  clearNodeTargetsCache,
  type ExistingSourceProbe,
} from "@/lib/brain/healthCheck";
import { extractDocument } from "@/lib/brain/extract";
import type { Embedder } from "@/lib/rag/types";

const FIXTURES_GOOD = path.join(process.cwd(), "tests", "fixtures", "brain", "good");
const FIXTURES_PATH = path.join(process.cwd(), "tests", "fixtures", "brain", "pathological");

/**
 * healthCheck embeds via embedPassage/embedPassages (both the probe AND all 41
 * real node targets) — unlike tests/rag/retriever.test.ts's FakeEmbedder, which
 * is query-focused and returns zero passage vectors. This one maps a text
 * substring to a vector; unmapped text (most of the 41 real node targets) gets
 * the zero vector, which cosineSimilarity defines as exactly 0 — giving a
 * clean, deterministic "off-topic" floor for anything we don't explicitly map.
 */
class FakePassageEmbedder implements Embedder {
  readonly id = "fake-health";
  readonly dim = 4;
  constructor(private readonly map: Record<string, number[]>) {}
  private vecFor(text: string): Float32Array {
    for (const [key, vec] of Object.entries(this.map)) {
      if (text.includes(key)) return Float32Array.from(vec);
    }
    return new Float32Array(this.dim);
  }
  async embedQuery(text: string): Promise<Float32Array> {
    return this.vecFor(text);
  }
  async embedPassage(text: string): Promise<Float32Array> {
    return this.vecFor(text);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.vecFor(t));
  }
}

function freshDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "q4np-health-test-"));
}

// Recognizes our equity-note fixture's own title/lead AND node 3.2's real
// tree title ("RSU & ESPP tax") as the same concept — everything else (the
// other 40 real nodes, the recipe, French text) gets the zero vector.
const RSU_EMBEDDER = new FakePassageEmbedder({
  "RSU vesting": [1, 0, 0, 0],
  "RSU & ESPP tax": [1, 0, 0, 0],
});

beforeEach(() => {
  clearNodeTargetsCache();
});

describe("hashContent", () => {
  it("is stable for identical content and differs for different content", () => {
    expect(hashContent("hello world")).toBe(hashContent("hello world"));
    expect(hashContent("hello world")).not.toBe(hashContent("hello there"));
  });

  it("trims before hashing so trailing whitespace doesn't create a false difference", () => {
    expect(hashContent("hello world")).toBe(hashContent("hello world\n\n  "));
  });
});

describe("runHealthCheck: on-topic classification against the real 41-node tree", () => {
  it("the real equity-note.md fixture classifies to node 3.2 with high confidence", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.md"));
    const extracted = await extractDocument("equity-note.md", buffer);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const result = await runHealthCheck(extracted.title, extracted.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });

    expect(result.suggestedNodeId).toBe("3.2");
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.status === "pass" || result.reasons.every((r) => r.code !== "off_topic")).toBe(
      true
    );
    expect(result.chunkEstimate).toBeGreaterThan(0);
    expect(result.preview.length).toBeGreaterThan(0);
  });

  it("the recipe fixture (off-topic.md) is flagged off_topic", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_PATH, "off-topic.md"));
    const extracted = await extractDocument("off-topic.md", buffer);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const result = await runHealthCheck(extracted.title, extracted.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });

    expect(result.status).toBe("warn");
    expect(result.reasons.some((r) => r.code === "off_topic")).toBe(true);
    expect(result.suggestedNodeId).toBeUndefined();
  });

  it("a genuinely on-topic, unmapped probe lands in the general bucket (between the two thresholds)", async () => {
    // Engineered so cosine([1,0,0,0], probe) is exactly 0.4 — strictly between
    // CLASSIFY_MIN_CONFIDENCE (0.3) and CLASSIFY_NODE_CONFIDENCE (0.45).
    const embedder = new FakePassageEmbedder({
      "RSU & ESPP tax": [1, 0, 0, 0],
      "GENERAL_PROBE_MARKER": [0.4, Math.sqrt(1 - 0.4 * 0.4), 0, 0],
    });
    const result = await runHealthCheck("General note", "GENERAL_PROBE_MARKER content here.", {
      embedder,
      dataDir: freshDataDir(),
    });
    expect(result.confidence).toBeCloseTo(0.4, 5);
    expect(result.suggestedNodeId).toBe("general");
    expect(result.reasons.some((r) => r.code === "off_topic")).toBe(false);
  });
});

describe("runHealthCheck: duplicate detection", () => {
  it("detects an exact duplicate via content hash", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.md"));
    const extracted = await extractDocument("equity-note.md", buffer);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const first = await runHealthCheck(extracted.title, extracted.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });
    const existing: ExistingSourceProbe[] = [
      { sourceId: "source-1", contentHash: first.contentHash, probeVector: first.probeVector },
    ];

    const second = await runHealthCheck(extracted.title, extracted.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
      existingSources: existing,
    });
    expect(second.isDuplicateOf).toBe("source-1");
    expect(second.reasons.some((r) => r.code === "exact_duplicate")).toBe(true);
  });

  it("detects a near-duplicate pair (different wording, same content-hash-distinct source)", async () => {
    const dataDir = freshDataDir();
    const bufA = fs.readFileSync(path.join(FIXTURES_PATH, "near-duplicate-a.md"));
    const bufB = fs.readFileSync(path.join(FIXTURES_PATH, "near-duplicate-b.md"));
    const a = await extractDocument("near-duplicate-a.md", bufA);
    const b = await extractDocument("near-duplicate-b.md", bufB);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const resultA = await runHealthCheck(a.title, a.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir,
    });
    // Sanity: truly different text, so hashes must differ — this is a NEAR
    // duplicate (embedding-cosine), not an exact one (content hash).
    const resultBAlone = await runHealthCheck(b.title, b.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir,
    });
    expect(resultA.contentHash).not.toBe(resultBAlone.contentHash);

    const resultB = await runHealthCheck(b.title, b.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir,
      existingSources: [
        { sourceId: "source-a", contentHash: resultA.contentHash, probeVector: resultA.probeVector },
      ],
    });
    expect(resultB.isDuplicateOf).toBe("source-a");
    expect(resultB.reasons.some((r) => r.code === "near_duplicate")).toBe(true);
    expect(resultB.reasons.some((r) => r.code === "exact_duplicate")).toBe(false);
  });

  it("does not flag two unrelated sources as duplicates", async () => {
    const dataDir = freshDataDir();
    const result = await runHealthCheck("Unrelated", "Something else entirely.", {
      embedder: RSU_EMBEDDER,
      dataDir,
      existingSources: [
        {
          sourceId: "source-x",
          contentHash: hashContent("completely different prior content"),
          probeVector: Float32Array.from([1, 0, 0, 0]),
        },
      ],
    });
    expect(result.isDuplicateOf).toBeUndefined();
  });
});

describe("runHealthCheck: non-English signal", () => {
  it("flags the genuinely French fixture with the honest English-centric wording", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_PATH, "non-english.md"));
    const extracted = await extractDocument("non-english.md", buffer);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const result = await runHealthCheck(extracted.title, extracted.markdown, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });
    const reason = result.reasons.find((r) => r.code === "non_english");
    expect(reason).toBeDefined();
    expect(reason?.message).toMatch(/english-centric/i);
  });

  it("does not flag ordinary English text", async () => {
    const result = await runHealthCheck(
      "English note",
      "This is a perfectly ordinary English sentence about restricted stock units.",
      { embedder: RSU_EMBEDDER, dataDir: freshDataDir() }
    );
    expect(result.reasons.some((r) => r.code === "non_english")).toBe(false);
  });
});

describe("runHealthCheck: readable / caps gates", () => {
  it("fails content that's too short to meaningfully evaluate", async () => {
    const result = await runHealthCheck("x", "hi", {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });
    expect(result.status).toBe("fail");
    expect(result.reasons[0].code).toBe("too_short");
  });

  it("fails extracted text over BRAIN_MAX_TEXT_MB", async () => {
    const huge = "word ".repeat(400_000); // well over 1.5MB as UTF-8
    const result = await runHealthCheck("Huge", huge, {
      embedder: RSU_EMBEDDER,
      dataDir: freshDataDir(),
    });
    expect(result.status).toBe("fail");
    expect(result.reasons[0].code).toBe("text_too_large");
  });
});

describe("runHealthCheck: node-target cache", () => {
  it("writes data/node-targets.bin + .json to the given dataDir on first use", async () => {
    const dataDir = freshDataDir();
    await runHealthCheck("Note", "Some ordinary note about restricted stock units.", {
      embedder: RSU_EMBEDDER,
      dataDir,
    });
    expect(fs.existsSync(path.join(dataDir, "node-targets.bin"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "node-targets.json"))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(dataDir, "node-targets.json"), "utf-8"));
    expect(meta.embedderId).toBe("fake-health");
    expect(meta.nodeIds.length).toBe(41);
  });

  it("reuses the cache on a second call with the same embedder + dataDir (no recompute needed)", async () => {
    const dataDir = freshDataDir();
    await runHealthCheck("Note", "First call about restricted stock units.", {
      embedder: RSU_EMBEDDER,
      dataDir,
    });
    const binMtime = fs.statSync(path.join(dataDir, "node-targets.bin")).mtimeMs;
    await runHealthCheck("Note", "Second call about restricted stock units.", {
      embedder: RSU_EMBEDDER,
      dataDir,
    });
    // Same file, untouched — proves the second call didn't recompute+rewrite.
    expect(fs.statSync(path.join(dataDir, "node-targets.bin")).mtimeMs).toBe(binMtime);
  });
});
