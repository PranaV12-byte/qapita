import path from "node:path";
import { getEmbedder } from "../rag/embedder";
import { cosineSimilarity } from "../rag/cosine";
import { chunkMarkdown } from "../rag/chunker";
import { extractTitleAndLead } from "../rag/textProbe";
import { getNodeTargets } from "./healthCheck";
import type { Embedder } from "../rag/types";
import { CLASSIFY_MIN_CONFIDENCE, CLASSIFY_NODE_CONFIDENCE, GENERAL_NODE_ID } from "../rag/config";

// ── Placement — heuristic v1 (SPEC-BRAIN.md Phase 3) ────────────────────────────
// Decides where an uploaded document's sections land in the wiki: each
// existing-topic node, "general", or — only when the WHOLE document is
// coherent-but-novel — a single new brain-local node. Pure and stateless
// (same {title, markdown} in -> same plan out); this is the exact shape
// Phase 5's LLM-backed placement will emit, so weave.ts never needs to know
// which one produced a plan.

export type NewNodeProposal = { id: string; title: string };

export type PlacementPlan = {
  /** sectionNodeIds[i] is the nodeId for chunkMarkdown's sections[i] (same
   *  markdown+title in both calls -> identical section count/order). */
  sectionNodeIds: string[];
  newNodes: NewNodeProposal[];
};

export type PlacementOpts = {
  embedder?: Embedder;
  dataDir?: string;
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

  const { sections } = chunkMarkdown(markdown, { title });
  if (sections.length === 0) return { sectionNodeIds: [], newNodes: [] };

  const { targets, vectors: targetVecs } = await getNodeTargets(embedder, dataDir);

  const sectionProbes = sections.map((s) =>
    [s.headingPath, s.text].filter(Boolean).join(" — ").slice(0, 600)
  );
  const sectionVecs = await embedder.embedPassages(sectionProbes);
  const perSectionBest = sectionVecs.map((vec) => bestMatch(vec, targetVecs));

  // Whole-document probe — same construction as healthCheck.ts's buildProbe,
  // used here to decide "does this doc as a whole deserve its own new node".
  const { title: h1Title, lead } = extractTitleAndLead(markdown);
  const effectiveTitle = h1Title || title;
  const docProbeText = [effectiveTitle, lead].filter(Boolean).join(". ") || markdown.slice(0, 200);
  const docVec = await embedder.embedPassage(docProbeText);
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
