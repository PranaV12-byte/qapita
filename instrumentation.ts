// Next 15 boot hook (stable — no config flag needed). Runs once per server
// process. We use it only to warm the local embedder + node-target cache off
// the hot path, so the first brain upload of a session isn't paying cold-model
// load + node-target compute latency on top of its own work (SPEC-VAULT §3).
// Nothing here can block or fail the server: it's fire-and-forget and swallows
// every error — ingest still works, just cold, if warm-up never finishes.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  void (async () => {
    try {
      const path = await import("node:path");
      const { getEmbedder } = await import("./lib/rag/embedder");
      const { getNodeTargets } = await import("./lib/brain/healthCheck");
      const embedder = getEmbedder();
      // A single tiny embed forces the transformers.js pipeline to load.
      await embedder.embedPassage("warm up");
      await getNodeTargets(embedder, path.join(process.cwd(), "data"));
    } catch {
      // Best-effort only.
    }
  })();
}
