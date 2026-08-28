import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { PILLARS } from "../lib/content/tree";
import { chunkMarkdown } from "../lib/rag/chunker";
import { getEmbedder } from "../lib/rag/embedder";
import { buildLexicalIndex } from "../lib/rag/lexical";
import { SCENARIOS } from "../lib/scenarios";
import type { IndexEntry, ParentSection } from "../lib/rag/types";

const root = process.cwd();
const contentRoot = path.join(root, "content", "pillars");
const dataDir = path.join(root, "data");

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(value));
}

async function main(): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true });

  const entries: IndexEntry[] = [];
  const parents: Record<string, ParentSection> = {};

  for (const pillar of PILLARS) {
    for (const node of pillar.nodes) {
      const articlePath = path.join(contentRoot, pillar.slug, `${node.slug}.mdx`);
      if (!fs.existsSync(articlePath)) continue;

      const source = fs.readFileSync(articlePath, "utf8");
      const parsed = matter(source);
      const title = typeof parsed.data.title === "string" ? parsed.data.title : node.title;
      const summary = typeof parsed.data.summaryPlain === "string" ? parsed.data.summaryPlain.trim() : "";
      const chunked = chunkMarkdown(parsed.content, {
        docId: `article:${node.id}`,
        title,
      });

      for (const section of chunked.sections) {
        parents[section.parentId] = {
          parentId: section.parentId,
          nodeId: node.id,
          title,
          headingPath: section.headingPath,
          text: section.text,
        };
      }

      for (const chunk of chunked.chunks) {
        entries.push({
          tier: "curated",
          nodeId: node.id,
          source: "curated",
          title,
          headingPath: chunk.headingPath,
          parentId: chunk.parentId,
          text: chunk.text,
        });
      }

      // The article summary is the canonical, short definition evidence. It
      // is indexed separately so a question such as "What is an ISO?" cannot
      // be answered from a semantically adjacent AMT detail section merely
      // because that detail shares the acronym.
      if (summary) {
        const parentId = `article:${node.id}#summary`;
        parents[parentId] = {
          parentId,
          nodeId: node.id,
          title,
          headingPath: "Overview",
          text: summary,
        };
        entries.push({
          tier: "curated",
          nodeId: node.id,
          source: "curated",
          title,
          headingPath: "Overview",
          parentId,
          sectionKind: "summary",
          text: `${title}\n${summary}`,
        });
      }
    }
  }

  for (const scenario of SCENARIOS) {
    entries.push({
      tier: "curated",
      isScenario: true,
      scenarioId: scenario.id,
      label: scenario.label,
      text: scenario.label,
    });
  }

  if (entries.length === 0) {
    throw new Error("No approved MDX content was found for the retrieval index.");
  }

  const embedder = getEmbedder();
  const vectors = await embedder.embedPassages(entries.map((entry) => entry.text));
  if (vectors.some((vector) => vector.length !== embedder.dim)) {
    throw new Error("The index embedder returned an unexpected vector dimension.");
  }

  const flat = new Float32Array(vectors.length * embedder.dim);
  vectors.forEach((vector, index) => flat.set(vector, index * embedder.dim));
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex");

  fs.writeFileSync(
    path.join(dataDir, "vectors.bin"),
    Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength)
  );
  writeJson("chunks.json", entries);
  writeJson("parents.json", parents);
  writeJson("lexical-index.json", buildLexicalIndex(entries));
  writeJson("index-manifest.json", {
    version: 1,
    taxonomyVersion: "v9-ui-1",
    embedderId: embedder.id,
    dimensions: embedder.dim,
    contentHash,
    entryCount: entries.length,
    builtAt: new Date().toISOString(),
  });

  console.log(`Built retrieval index with ${entries.length} entries using ${embedder.id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
