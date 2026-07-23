// Next 15 boot hook (stable — no config flag needed). Runs once per server
// process, in BOTH the edge and nodejs runtimes. The warm-up touches node-only
// modules (fs/crypto via the embedder + content loader), so it MUST stay out of
// the edge bundle: guarding the dynamic import on NEXT_RUNTIME === "nodejs" is
// Next's documented way to exclude a branch from the edge compile.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/warmup");
  }
}
