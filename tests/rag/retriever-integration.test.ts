/**
 * Integration — real local embedder + a real temp index built from the curated
 * articles. Uses whatever EMBEDDER_MODEL resolves to on disk (all-MiniLM-L6-v2
 * by default; bge-base if its weights are present). Rerank stays off unless the
 * cross-encoder weights + RERANK_ENABLED=true are configured.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMP_DIR = path.join(os.tmpdir(), "q4np-rag-integration");

describe(
  "real embedder",
  () => {
    it("embedQuery returns a vector of the embedder's dimension", async () => {
      const { getEmbedder } = await import("@/lib/rag/embedder");
      const embedder = getEmbedder();
      const v = await embedder.embedQuery("restricted stock unit vesting");
      expect(v).toBeInstanceOf(Float32Array);
      expect(v.length).toBe(embedder.dim);
    });

    it("related concepts are more similar than unrelated ones", async () => {
      const { getEmbedder } = await import("@/lib/rag/embedder");
      const { cosineSimilarity } = await import("@/lib/rag/cosine");
      const e = getEmbedder();
      const a = await e.embedPassage("restricted stock unit vesting schedule");
      const near = await e.embedPassage("RSU vesting and tax withholding");
      const far = await e.embedPassage("Belgian chocolate tart recipe");
      expect(cosineSimilarity(a, near)).toBeGreaterThan(cosineSimilarity(a, far));
    });
  },
  { timeout: 300_000 }
);

describe(
  "build + retrieve end-to-end",
  () => {
    beforeAll(async () => {
      const { buildIndex } = await import("@/scripts/ingest/build");
      await buildIndex(TEMP_DIR);
    }, 600_000);

    it("writes vectors.bin and chunks.json", () => {
      expect(fs.existsSync(path.join(TEMP_DIR, "vectors.bin"))).toBe(true);
      expect(fs.existsSync(path.join(TEMP_DIR, "chunks.json"))).toBe(true);
      expect(fs.existsSync(path.join(TEMP_DIR, "lexical-index.json"))).toBe(true);
      expect(fs.existsSync(path.join(TEMP_DIR, "parents.json"))).toBe(true);
    });

    it("vectors.bin size matches entries × dim × 4 bytes", async () => {
      const { getEmbedder } = await import("@/lib/rag/embedder");
      const dim = getEmbedder().dim;
      const entries = JSON.parse(
        fs.readFileSync(path.join(TEMP_DIR, "chunks.json"), "utf-8")
      ) as unknown[];
      const size = fs.statSync(path.join(TEMP_DIR, "vectors.bin")).size;
      expect(size).toBe(entries.length * dim * 4);
    });

    it("'How are RSUs taxed?' retrieves RSU/tax nodes", async () => {
      const { loadStores, retrieveWith } = await import("@/lib/rag/retriever");
      const stores = loadStores(TEMP_DIR);
      const res = await retrieveWith("How are RSUs taxed?", stores, {});
      const nodeIds = res.chunks.map((c) => c.nodeId);
      expect(nodeIds.some((id) => id === "1.3" || id === "3.2")).toBe(true);
    }, 300_000);

    it("an off-topic query triggers the scenario fallback", async () => {
      const { loadStores, retrieveWith } = await import("@/lib/rag/retriever");
      const stores = loadStores(TEMP_DIR);
      const res = await retrieveWith(
        "sourdough bread fermentation hydration starter",
        stores,
        { rerank: false }
      );
      expect(res.fallbackUsed).toBe(true);
    }, 300_000);
  },
  { timeout: 600_000 }
);
