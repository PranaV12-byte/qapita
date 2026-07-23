// Node-runtime-only boot warm-up (imported by instrumentation.ts under the
// NEXT_RUNTIME==="nodejs" guard, so this never enters the edge bundle).
// Warms the local embedder + node-target cache off the hot path so the first
// brain upload of a session isn't cold (SPEC-VAULT §3). Fire-and-forget and
// swallows every error — ingest still works cold if warm-up never finishes.
import path from "node:path";
import { getEmbedder } from "./rag/embedder";
import { getNodeTargets } from "./brain/healthCheck";

void (async () => {
  try {
    const embedder = getEmbedder();
    await embedder.embedPassage("warm up");
    await getNodeTargets(embedder, path.join(process.cwd(), "data"));
  } catch {
    // Best-effort only.
  }
})();
