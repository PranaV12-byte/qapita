import fs from "node:fs";
import path from "node:path";
import { loadAllArticles } from "../../lib/content/loader";
import { SCENARIOS } from "../../lib/scenarios";
import { chunkMarkdown } from "../../lib/rag/chunker";
import { buildLexicalIndex } from "../../lib/rag/lexical";
import { getEmbedder, EmbedCache } from "../../lib/rag/embedder";
import { buildEmbedInput } from "./contextualize";
import type {
  ChunkMeta,
  IndexEntry,
  ParentSection,
  ScenarioMeta,
  SourceName,
} from "../../lib/rag/types";

const DATA_DIR = path.join(process.cwd(), "data");
const EMBED_BLOCK = 256; // flush cache each block so overnight runs resume cleanly

function inferSource(filePath: string): SourceName {
  const p = filePath.toLowerCase();
  if (p.includes("naspp")) return "NASPP";
  if (p.includes("nso") || p.includes("mystockoptions")) return "myStockOptions";
  return "scrape";
}

type ScrapeManifestItem = {
  filePath: string;
  nodeId: string;
  source?: SourceName;
};

/**
 * Build the retrieval index: curated MDX + manifest-listed scrape files + scenarios,
 * chunked heading-aware, embedded through the content-hash cache. Writes
 * vectors.bin, chunks.json, parents.json, lexical-index.json, index-manifest.json.
 * Incremental by construction: unchanged embed-inputs are cache hits.
 */
export async function buildIndex(outputDir: string = DATA_DIR): Promise<void> {
  const entries: IndexEntry[] = [];
  const parents: Record<string, ParentSection> = {};
  const embedInputs: string[] = [];

  async function addDoc(
    markdown: string,
    meta: {
      tier: "curated" | "scrape";
      nodeId?: string;
      source?: SourceName;
      docId: string;
      titleFallback?: string;
    }
  ): Promise<void> {
    const { chunks, sections, title } = chunkMarkdown(markdown, {
      docId: meta.docId,
      title: meta.titleFallback,
    });
    for (const s of sections) {
      parents[s.parentId] = {
        parentId: s.parentId,
        nodeId: meta.nodeId,
        title,
        headingPath: s.headingPath,
        text: s.text,
      };
    }
    for (const c of chunks) {
      const entry: ChunkMeta = {
        tier: meta.tier,
        nodeId: meta.nodeId,
        source: meta.source,
        title,
        headingPath: c.headingPath,
        parentId: c.parentId,
        text: c.text,
        isScenario: false,
      };
      entries.push(entry);
      embedInputs.push(await buildEmbedInput(title, c.headingPath, c.text));
    }
  }

  // ── Curated articles ──
  const articles = await loadAllArticles();
  for (const { frontmatter, content } of articles) {
    await addDoc(content, {
      tier: "curated",
      nodeId: frontmatter.id,
      source: "curated",
      docId: `curated/${frontmatter.id}`,
      titleFallback: frontmatter.title,
    });
  }
  console.log(`[build] curated articles: ${articles.length}`);

  // ── Scrape files (from reviewed manifest) ──
  const manifestPath = path.join(outputDir, "scrape-manifest.json");
  let scrapeCount = 0;
  let excludedMso = 0;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    ) as ScrapeManifestItem[];
    for (const item of manifest) {
      const source = item.source ?? inferSource(item.filePath);
      // Policy: myStockOptions (NSO) data is never ingested — NASPP-only grounding.
      // Enforced here so exclusion holds even if the manifest is regenerated.
      if (source === "myStockOptions") {
        excludedMso++;
        continue;
      }
      if (!fs.existsSync(item.filePath)) {
        console.warn(`[build] missing scrape file, skipping: ${item.filePath}`);
        continue;
      }
      const raw = fs.readFileSync(item.filePath, "utf-8");
      const fallbackTitle = path
        .basename(item.filePath, ".md")
        .replace(/^\d+_/, "");
      await addDoc(raw, {
        tier: "scrape",
        nodeId: item.nodeId,
        source,
        docId: item.filePath,
        titleFallback: fallbackTitle,
      });
      scrapeCount++;
    }
  }
  console.log(
    `[build] scrape files: ${scrapeCount} (excluded myStockOptions: ${excludedMso})`
  );

  // ── Scenario entries ──
  for (const s of SCENARIOS) {
    const text = `${s.label} ${s.keywords.join(" ")}`;
    const entry: ScenarioMeta = {
      tier: "curated",
      isScenario: true,
      scenarioId: s.id,
      label: s.label,
      text,
    };
    entries.push(entry);
    embedInputs.push(text);
  }

  console.log(`[build] total entries: ${entries.length} — embedding…`);

  // ── Embed (cached + checkpointed) ──
  const cache = new EmbedCache(path.join(outputDir, ".embed-cache.json"));
  const embedder = getEmbedder();
  const vecList: Float32Array[] = [];
  for (let i = 0; i < embedInputs.length; i += EMBED_BLOCK) {
    const block = embedInputs.slice(i, i + EMBED_BLOCK);
    const vecs = await cache.embedPassages(embedder, block);
    vecList.push(...vecs);
    cache.flush();
    process.stdout.write(
      `\r[build] embedded ${Math.min(i + EMBED_BLOCK, embedInputs.length)}/${embedInputs.length}…`
    );
  }
  process.stdout.write("\n");
  const stats = cache.stats();
  console.log(`[build] embed cache: ${stats.hits} hits / ${stats.misses} misses`);

  // ── Write outputs ──
  const dim = vecList.length > 0 ? vecList[0].length : embedder.dim;
  const flat = new Float32Array(entries.length * dim);
  vecList.forEach((v, i) => flat.set(v, i * dim));

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "vectors.bin"), Buffer.from(flat.buffer));
  fs.writeFileSync(path.join(outputDir, "chunks.json"), JSON.stringify(entries));
  fs.writeFileSync(path.join(outputDir, "parents.json"), JSON.stringify(parents));
  fs.writeFileSync(
    path.join(outputDir, "lexical-index.json"),
    JSON.stringify(buildLexicalIndex(entries))
  );
  fs.writeFileSync(
    path.join(outputDir, "index-manifest.json"),
    JSON.stringify(
      {
        embedderId: embedder.id,
        dim,
        entries: entries.length,
        contentChunks: entries.filter((e) => !e.isScenario).length,
        scenarios: SCENARIOS.length,
        contextual: process.env.CONTEXTUAL_ENRICHMENT === "true",
      },
      null,
      2
    )
  );

  console.log(`[build] wrote index (${entries.length} entries, dim ${dim}) to ${outputDir}`);
}

if (require.main === module || process.argv[1]?.endsWith("build.ts")) {
  buildIndex().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
