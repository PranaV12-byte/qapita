import path from "node:path";
import { getEmbedder } from "../rag/embedder";
import { cosineSimilarity } from "../rag/cosine";
import { chunkMarkdown } from "../rag/chunker";
import { extractTitleAndLead } from "../rag/textProbe";
import { getNodeTargets } from "./healthCheck";
import { proposePlacement, type RawLLMCaller } from "./maintain";
import type { SectionResult } from "../rag/chunker";
import type { Embedder } from "../rag/types";
import { CLASSIFY_MIN_CONFIDENCE, CLASSIFY_NODE_CONFIDENCE, GENERAL_NODE_ID } from "../rag/config";

/**
 * Decides where an uploaded document belongs: an existing topic, the general
 * bucket, or one coherent new private topic. The heuristic is deterministic;
 * an optional provider may propose the same plan shape, leaving weaving unaware
 * of how the decision was made.
 */

export type NewNodeProposal = { id: string; title: string };

export type PlacementPlan = {
  /** sectionNodeIds[i] is the nodeId for chunkMarkdown's sections[i] (same
   *  markdown+title in both calls -> identical section count/order). */
  sectionNodeIds: string[];
  newNodes: NewNodeProposal[];
};

/** Vectors already computed by the single-pass ingest pipeline (V0), reused
 *  here so placement never re-chunks or re-embeds. `sectionVecs[i]` is the
 *  (normalized) mean of section[i]'s chunk vectors; `probeVector` is the exact
 *  whole-document probe healthCheck already embedded. */
export type PrecomputedPlacement = {
  sections: SectionResult[];
  sectionVecs: Float32Array[];
  probeVector: Float32Array;
};

export type PlacementOpts = {
  embedder?: Embedder;
  dataDir?: string;
  /** LLM caller (maintain.ts). Offline/no-provider → null → heuristic below. */
  caller?: RawLLMCaller;
  /** Reuse the ingest pipeline's vectors instead of re-chunking/re-embedding. */
  precomputed?: PrecomputedPlacement;
};

/** Moderate pairwise cosine among a document's own sections — the bar for
 *  "this reads as one coherent topic" rather than a grab-bag of unrelated
 *  content that merely all scored low against existing nodes. */
const SECTION_COHERENCE_THRESHOLD = 0.5;

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip diacritics (Unicode combining marks left by NFKD)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "note";
}

function bestMatch(vec: Float32Array, targetVecs: Float32Array[]): { i: number; cos: number } {
  let best = { i: -1, cos: -Infinity };
  targetVecs.forEach((tv, i) => {
    const cos = cosineSimilarity(vec, tv);
    if (cos > best.cos) best = { i, cos };
  });
  return best;
}

export async function planPlacement(
  title: string,
  markdown: string,
  opts: PlacementOpts = {}
): Promise<PlacementPlan> {
  const embedder = opts.embedder ?? getEmbedder();
  const dataDir = opts.dataDir ?? path.join(process.cwd(), "data");
  const pre = opts.precomputed;

  const sections = pre ? pre.sections : chunkMarkdown(markdown, { title }).sections;
  if (sections.length === 0) return { sectionNodeIds: [], newNodes: [] };

  // A provider may improve placement when available. Returning null deliberately
  // keeps the deterministic heuristic below as the local and failure-safe path.
  const sectionSummaries = sections.map((s) =>
    [s.headingPath, s.text].filter(Boolean).join(" — ")
  );
  const llmPlan = await proposePlacement(title, sectionSummaries, { caller: opts.caller });
  if (llmPlan) return llmPlan;

  const { targets, vectors: targetVecs } = await getNodeTargets(embedder, dataDir);

  // Whole-document novelty is judged from the same probe healthCheck built
  // (title + lead); effectiveTitle names any new node identically in both paths.
  const { title: h1Title, lead } = extractTitleAndLead(markdown);
  const effectiveTitle = h1Title || title;

  let sectionVecs: Float32Array[];
  let docVec: Float32Array;
  if (pre) {
    // Single-pass path (V0): section vector = normalized mean of its chunk
    // vectors; the doc probe is healthCheck's already-embedded probeVector.
    sectionVecs = pre.sectionVecs;
    docVec = pre.probeVector;
  } else {
    const sectionProbes = sections.map((s) =>
      [s.headingPath, s.text].filter(Boolean).join(" — ").slice(0, 600)
    );
    sectionVecs = await embedder.embedPassages(sectionProbes);
    const docProbeText =
      [effectiveTitle, lead].filter(Boolean).join(". ") || markdown.slice(0, 200);
    docVec = await embedder.embedPassage(docProbeText);
  }
  const perSectionBest = sectionVecs.map((vec) => bestMatch(vec, targetVecs));
  const docBest = bestMatch(docVec, targetVecs);

  const isNovelCandidate =
    docBest.cos < CLASSIFY_NODE_CONFIDENCE && docBest.cos >= CLASSIFY_MIN_CONFIDENCE;

  let sectionsCoherent = false;
  if (isNovelCandidate) {
    if (sectionVecs.length <= 1) {
      sectionsCoherent = true;
    } else {
      let total = 0;
      let count = 0;
      for (let i = 0; i < sectionVecs.length; i++) {
        for (let j = i + 1; j < sectionVecs.length; j++) {
          total += cosineSimilarity(sectionVecs[i], sectionVecs[j]);
          count++;
        }
      }
      sectionsCoherent = total / count >= SECTION_COHERENCE_THRESHOLD;
    }
  }

  if (isNovelCandidate && sectionsCoherent) {
    const newNodeId = `u-${slugify(effectiveTitle)}`;
    return {
      sectionNodeIds: sections.map(() => newNodeId),
      newNodes: [{ id: newNodeId, title: effectiveTitle }],
    };
  }

  // Normal path: each section placed independently — the same document can
  // feed several existing nodes at once.
  const sectionNodeIds = perSectionBest.map((best) => {
    if (best.i < 0 || best.cos < CLASSIFY_MIN_CONFIDENCE) return GENERAL_NODE_ID;
    if (best.cos >= CLASSIFY_NODE_CONFIDENCE) return targets[best.i].id;
    return GENERAL_NODE_ID;
  });

  return { sectionNodeIds, newNodes: [] };
}
