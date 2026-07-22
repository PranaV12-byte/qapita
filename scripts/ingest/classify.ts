import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { loadAllArticles } from "../../lib/content/loader";
import { ALL_NODES } from "../../lib/content/tree";
import { getEmbedder } from "../../lib/rag/embedder";
import { cosineSimilarity } from "../../lib/rag/cosine";
import { extractTitleAndLead } from "../../lib/rag/textProbe";
import {
  CLASSIFY_MIN_CONFIDENCE,
  CLASSIFY_NODE_CONFIDENCE,
  GENERAL_NODE_ID,
  GENERAL_NODE_TITLE,
} from "../../lib/rag/config";

// Re-exported so existing imports of `extractTitleAndLead` from this module
// keep working — the implementation now lives in lib/rag/textProbe.ts so
// lib/brain/healthCheck.ts can use it without depending on this file's
// fast-glob import (a devDependency; wrong to pull into a runtime bundle).
export { extractTitleAndLead };

const HEADER = [
  "filePath",
  "disposition",
  "suggestedNodeId",
  "suggestedNodeTitle",
  "confidence",
  "secondBestNodeId",
  "secondBestConfidence",
  "flaggedChunks",
];

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Suggest a taxonomy node per scrape file by cosine of (title + lead) against
 * per-node targets. Emits a reviewable CSV with a three-way disposition
 * (node / general / off-topic). Nothing is committed — a human edits the CSV,
 * then apply-classification.ts turns it into the build manifest.
 */
export async function classify(
  inboxDir: string,
  outCsv: string
): Promise<void> {
  const files = await fg("**/*.md", { cwd: inboxDir, absolute: true });
  const contentFiles = files.filter(
    (f) => path.basename(f).toLowerCase() !== "_index.md"
  );
  console.log(`[classify] ${contentFiles.length} files under ${inboxDir}`);

  const embedder = getEmbedder();

  // Node targets: title enriched with the curated summary where one exists.
  const articles = await loadAllArticles();
  const summaryById = new Map(
    articles.map((a) => [a.frontmatter.id, a.frontmatter.summaryPlain])
  );
  const targets = ALL_NODES.map((n) => ({
    id: n.id,
    title: n.title,
    text: summaryById.has(n.id)
      ? `${n.title}. ${summaryById.get(n.id)}`
      : n.title,
  }));
  const targetVecs = await embedder.embedPassages(targets.map((t) => t.text));

  const rows: string[] = [HEADER.join(",")];

  for (const file of contentFiles) {
    const raw = fs.readFileSync(file, "utf-8");
    const { title, lead } = extractTitleAndLead(raw);
    const probe =
      [title, lead].filter(Boolean).join(". ") || path.basename(file, ".md");
    const vec = await embedder.embedPassage(probe);

    let best = { i: -1, cos: -Infinity };
    let second = { i: -1, cos: -Infinity };
    targetVecs.forEach((tv, i) => {
      const cos = cosineSimilarity(vec, tv);
      if (cos > best.cos) {
        second = best;
        best = { i, cos };
      } else if (cos > second.cos) {
        second = { i, cos };
      }
    });

    const bestNode = targets[best.i];
    const secondNode = second.i >= 0 ? targets[second.i] : undefined;

    let disposition: string;
    let suggestedNodeId: string;
    let suggestedNodeTitle: string;
    if (best.cos < CLASSIFY_MIN_CONFIDENCE) {
      disposition = "off-topic";
      suggestedNodeId = "";
      suggestedNodeTitle = "";
    } else if (best.cos >= CLASSIFY_NODE_CONFIDENCE) {
      disposition = "node";
      suggestedNodeId = bestNode.id;
      suggestedNodeTitle = bestNode.title;
    } else {
      disposition = "general";
      suggestedNodeId = GENERAL_NODE_ID;
      suggestedNodeTitle = GENERAL_NODE_TITLE;
    }

    const ambiguous =
      secondNode && best.cos - second.cos < 0.05 ? "ambiguous" : "";

    rows.push(
      [
        csv(file),
        disposition,
        suggestedNodeId,
        csv(suggestedNodeTitle),
        best.cos.toFixed(4),
        secondNode?.id ?? "",
        second.cos > -Infinity ? second.cos.toFixed(4) : "",
        ambiguous,
      ].join(",")
    );
  }

  fs.mkdirSync(path.dirname(outCsv), { recursive: true });
  fs.writeFileSync(outCsv, rows.join("\n"));
  console.log(`[classify] wrote ${outCsv} (${contentFiles.length} rows)`);
}

if (require.main === module || process.argv[1]?.endsWith("classify.ts")) {
  const inbox =
    process.argv[2] ??
    process.env.SCRAPE_INBOX ??
    path.join(process.cwd(), "scrape-inbox");
  const out =
    process.argv[3] ??
    path.join(process.cwd(), "data", "scrape-review", "classification-queue.csv");
  classify(inbox, out).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
